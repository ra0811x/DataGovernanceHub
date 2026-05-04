/**
 * 动态第三级“配置查询”底座
 * 目标：把弹窗结构和字段文案收敛到 JSON 定义中，现阶段默认只注册，不替换既有固定弹窗。
 */
(function(global) {
    'use strict';

    const DYNAMIC_QUERY_STATE = {
        definitions: {},
        currentContext: null,
        jsonDirty: false,
        transientValues: {},
        apiBase: '/api'  // API基础路径
    };

    const PROTECTED_RULE_KEYS = new Set([
        'target_column',
        'target_name',
        'source_type'
    ]);

    const SINGLE_CONDITIONAL_TEMPLATE_PRESETS = {
        data_storage_status: {
            label: '数据存储状态判断',
            conditions: [
                { match: '1', result: '未处理' },
                { match: '2', result: '未处理' },
                { match: '3', result: '数据脱敏处理' },
                { match: '4', result: '数据加密处理' }
            ],
            default: '未处理'
        },
        data_purpose_ad_class: {
            label: '处理目的判断(A-D类)',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '4A管控' },
                { match: '^B\\d+-', regex: true, result: '4B管控' },
                { match: '^C\\d+-', regex: true, result: '4C管控' },
                { match: '^D\\d+-', regex: true, result: '4D管控' }
            ],
            default: ''
        },
        data_path_ad_class: {
            label: '流转路径判断(A-D类)',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '4A管控' },
                { match: '^B\\d+-', regex: true, result: '4B管控' },
                { match: '^C\\d+-', regex: true, result: '4C管控' },
                { match: '^D\\d+-', regex: true, result: '4D管控' }
            ],
            default: ''
        },
        data_scenario_ad_class: {
            label: '应用场景判断(A-D类)',
            conditions: [
                { match: '^A\\d+-', regex: true, result: '4A管控' },
                { match: '^B\\d+-', regex: true, result: '4B管控' },
                { match: '^C\\d+-', regex: true, result: '4C管控' },
                { match: '^D\\d+-', regex: true, result: '4D管控' }
            ],
            default: ''
        },
        data_measure_ad_class: {
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

    const DEFAULT_DYNAMIC_CONFIG_QUERY_DEFINITIONS = {
        conditional_single: {
            enabled: true,
            version: '1.0',
            title: '单字段条件判断',
            subtitle: '按一个字段的值顺序判断输出结果。',
            toneColor: '#0f4fa8',
            description: '适用于一个字段决定当前列输出的场景。条件数组仍在 JSON 区维护，模块区主要负责常用字段和模板辅助。',
            workflowSteps: [
                { label: '读取字段', text: '从 {{rule_source_name}} 读取 {{source_value}} 作为判断源值' },
                { label: '顺序匹配', text: '按 conditions 数组从上到下依次判断，当前共 {{condition_count}} 条条件' },
                { label: '返回结果', text: '命中后返回对应 result，全部未命中时返回 {{default}}' }
            ],
            effectText: '保存后会直接影响当前列按哪个字段做单字段判断，以及所有命中和兜底结果。',
            dependencyTextTemplate: '依赖 {{rule_source_name}} 字段和当前规则中的 conditions 条件数组',
            fields: [
                { key: 'source_value', type: 'field_select', dataSource: 'rule_source', label: '判断字段', required: true, description: '先从当前主数据源选择一个字段，系统会用这个字段值去匹配条件数组。' },
                {
                    key: 'preset_template',
                    type: 'select',
                    label: '条件模板',
                    transient: true,
                    runtimeValueResolver: 'detect_single_conditional_template',
                    action: 'apply_single_conditional_template',
                    description: '模板只会覆盖 conditions 和默认值，便于快速起步，后续仍可继续手改 JSON。',
                    options: [
                        { value: '', label: '不使用模板' },
                        { value: 'data_storage_status', label: '数据存储状态判断' },
                        { value: 'data_purpose_ad_class', label: '处理目的判断(A-D类)' },
                        { value: 'data_path_ad_class', label: '流转路径判断(A-D类)' },
                        { value: 'data_scenario_ad_class', label: '应用场景判断(A-D类)' },
                        { value: 'data_measure_ad_class', label: '安全措施判断(A-D类)' }
                    ]
                },
                { key: 'default', type: 'text', label: '默认值', placeholder: '条件未命中时返回的值', description: '所有条件都没有命中时，当前列输出这里填写的值。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '补充当前规则的说明', description: '建议写清楚判断口径，便于后期维护和 JSON 导入导出时理解。' },
                { type: 'info', title: '条件数组', text: '具体 conditions 数组仍可在 JSON 编辑区直接维护。' }
            ],
            jsonKeys: ['source_value', 'conditions', 'default', 'remarks'],
            jsonExample: {
                source_value: '',
                conditions: [],
                default: '',
                remarks: ''
            },
            summaryTemplate: '对字段 {{source_value}} 进行单字段条件判断，共 {{condition_count}} 条条件，未命中时返回 {{default}}'
        },
        conditional_multi: {
            enabled: true,
            version: '1.0',
            title: '多字段条件判断',
            subtitle: '支持“简单联合判断”和“条件组判断”两种模式。',
            toneColor: '#2563eb',
            description: '这类配置适合多个字段联合决定输出结果的场景。当前已支持简单模式与条件组模式的动态切换，复杂的 conditions 或 groups 结构仍在 JSON 区维护。',
            workflowSteps: [
                { label: '读取多个字段', text: '从 {{rule_source_name}} 读取多个条件字段，当前模式为 {{multi_mode_label}}' },
                { label: '按模式判断', text: '{{multi_mode_description}}' },
                { label: '返回结果', text: '{{multi_mode_result_description}}' }
            ],
            effectText: '保存后会直接影响当前列按简单模式还是条件组模式判断，以及命中和未命中时的输出结果。',
            dependencyTextTemplate: '依赖 {{rule_source_name}} 多字段条件配置，当前为 {{multi_mode_label}}',
            fields: [
                {
                    key: 'mode',
                    type: 'select',
                    label: '判断模式',
                    transient: true,
                    runtimeValueResolver: 'detect_multi_conditional_mode',
                    action: 'apply_multi_conditional_mode',
                    description: '简单模式适合一组 conditions 联合判断；条件组模式适合多组规则汇总。',
                    options: [
                        { value: 'simple', label: '简单模式' },
                        { value: 'groups', label: '条件组模式' }
                    ]
                },
                {
                    key: 'logic',
                    type: 'select',
                    label: '条件逻辑',
                    visibleWhen: { field: 'mode', equals: 'simple' },
                    description: '简单模式下，conditions 列表会按这里设置的 AND 或 OR 逻辑联合判断。',
                    options: [{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }]
                },
                {
                    key: 'result',
                    type: 'text',
                    label: '命中结果',
                    visibleWhen: { field: 'mode', equals: 'simple' },
                    placeholder: '条件命中时返回的值',
                    description: '简单模式下，conditions 组合判断成立时返回这里的值。'
                },
                {
                    key: 'group_logic',
                    type: 'select',
                    label: '组间逻辑',
                    visibleWhen: { field: 'mode', equals: 'groups' },
                    description: '条件组模式下，各组判断完成后，再按这里的逻辑汇总。',
                    options: [{ value: 'OR', label: 'OR' }, { value: 'AND', label: 'AND' }]
                },
                { key: 'default', type: 'text', label: '默认值', placeholder: '条件未命中时返回的值', description: '简单模式和条件组模式都会用到这个兜底值。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '补充当前规则的说明', description: '建议写清楚字段口径、模式选择原因和维护说明。' },
                { type: 'info', title: '复杂结构说明', text: '简单模式下请在 JSON 区维护 conditions；条件组模式下请在 JSON 区维护 groups。' }
            ],
            jsonKeys: ['logic', 'conditions', 'result', 'default', 'group_logic', 'groups', 'remarks'],
            jsonExample: {
                logic: 'AND',
                conditions: [],
                result: '',
                default: '',
                group_logic: 'OR',
                groups: [],
                remarks: ''
            },
            summaryTemplate: '当前按 {{multi_mode_label}} 配置多字段判断，{{condition_or_group_summary}}，未命中返回 {{default}}'
        },
        field_assets_with_transform: {
            enabled: true,
            version: '1.0',
            title: '数据概览字段+转换',
            subtitle: '先读取数据概览表字段，再按条件进行转换。',
            toneColor: '#0369a1',
            description: '适用于“先取字段，再按单字段条件转换结果”的场景。当前列的 transform 会保留原口径继续参与输出。',
            workflowSteps: [
                { label: '读取源字段', text: '从数据概览表读取 {{source_value}} 作为判断源值' },
                { label: '条件转换', text: '按 conditions 数组顺序匹配，当前共 {{condition_count}} 条条件' },
                { label: '结果输出', text: '命中后返回 result，未命中时返回 {{default}}，并保留当前 transform={{transform}} 的口径' }
            ],
            effectText: '保存后会直接影响当前列从数据概览表读取哪个字段，并按什么条件规则转换输出。',
            dependencyTextTemplate: '依赖数据概览表字段、conditions 条件数组和当前列 transform={{transform}}',
            fields: [
                { key: 'source_value', type: 'field_select', dataSource: 'assets', label: '源字段', required: true, description: '从数据概览表选择一个字段，先把该字段值取出来，再进行条件转换。' },
                {
                    key: 'preset_template',
                    type: 'select',
                    label: '条件模板',
                    transient: true,
                    runtimeValueResolver: 'detect_single_conditional_template',
                    action: 'apply_single_conditional_template',
                    description: '模板只影响 conditions 和默认值，便于快速生成常用判断逻辑。',
                    options: [
                        { value: '', label: '不使用模板' },
                        { value: 'data_storage_status', label: '数据存储状态判断' },
                        { value: 'data_purpose_ad_class', label: '处理目的判断(A-D类)' },
                        { value: 'data_path_ad_class', label: '流转路径判断(A-D类)' },
                        { value: 'data_scenario_ad_class', label: '应用场景判断(A-D类)' },
                        { value: 'data_measure_ad_class', label: '安全措施判断(A-D类)' }
                    ]
                },
                { key: 'default', type: 'text', label: '默认值', placeholder: '条件未命中时返回的值', description: '如果所有条件都未命中，当前列返回这个兜底值。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '补充当前字段转换规则的说明', description: '建议补充当前列为什么要做转换，方便后续接线。' },
                { type: 'info', title: '转换规则', text: 'conditions 数组在 JSON 编辑区维护。' }
            ],
            jsonKeys: ['source_value', 'conditions', 'default', 'remarks'],
            jsonExample: {
                source_value: '',
                conditions: [],
                default: '',
                remarks: ''
            },
            summaryTemplate: '读取数据概览字段 {{source_value}}，按 {{condition_count}} 条条件转换后输出，当前 transform={{transform}}'
        },
        field_merge_with_transform: {
            enabled: true,
            version: '1.0',
            title: '合并结果字段+转换',
            subtitle: '先读取合并结果表字段，再按条件进行转换。',
            toneColor: '#0284c7',
            description: '适用于“先取合并结果表字段，再按单字段条件转换结果”的场景。当前列的 transform 会保留原口径继续参与输出。',
            workflowSteps: [
                { label: '读取源字段', text: '从合并结果表读取 {{source_value}} 作为判断源值' },
                { label: '条件转换', text: '按 conditions 数组顺序匹配，当前共 {{condition_count}} 条条件' },
                { label: '结果输出', text: '命中后返回 result，未命中时返回 {{default}}，并保留当前 transform={{transform}} 的口径' }
            ],
            effectText: '保存后会直接影响当前列从合并结果表读取哪个字段，并按什么条件规则转换输出。',
            dependencyTextTemplate: '依赖合并结果表字段、conditions 条件数组和当前列 transform={{transform}}',
            fields: [
                { key: 'source_value', type: 'field_select', dataSource: 'merge_results', label: '源字段', required: true, description: '从合并结果表选择一个字段，先把该字段值取出来，再进行条件转换。' },
                {
                    key: 'preset_template',
                    type: 'select',
                    label: '条件模板',
                    transient: true,
                    runtimeValueResolver: 'detect_single_conditional_template',
                    action: 'apply_single_conditional_template',
                    description: '模板只影响 conditions 和默认值，便于快速生成常用判断逻辑。',
                    options: [
                        { value: '', label: '不使用模板' },
                        { value: 'data_storage_status', label: '数据存储状态判断' },
                        { value: 'data_purpose_ad_class', label: '处理目的判断(A-D类)' },
                        { value: 'data_path_ad_class', label: '流转路径判断(A-D类)' },
                        { value: 'data_scenario_ad_class', label: '应用场景判断(A-D类)' },
                        { value: 'data_measure_ad_class', label: '安全措施判断(A-D类)' }
                    ]
                },
                { key: 'default', type: 'text', label: '默认值', placeholder: '条件未命中时返回的值', description: '如果所有条件都未命中，当前列返回这个兜底值。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '补充当前字段转换规则的说明', description: '建议补充当前列为什么要做转换，方便后续接线。' },
                { type: 'info', title: '转换规则', text: 'conditions 数组在 JSON 编辑区维护。' }
            ],
            jsonKeys: ['source_value', 'conditions', 'default', 'remarks'],
            jsonExample: {
                source_value: '',
                conditions: [],
                default: '',
                remarks: ''
            },
            summaryTemplate: '读取合并结果字段 {{source_value}}，按 {{condition_count}} 条条件转换后输出，当前 transform={{transform}}'
        },
        vlookup: {
            enabled: true,
            version: '1.0',
            title: '跨表查询',
            subtitle: '使用当前报表字段作为查找键，到数据概览表联查目标字段。',
            toneColor: '#0f766e',
            description: '这类配置适合“当前表有键值，数据概览表里有标准结果”的场景。字段、说明和步骤文案都由当前动态定义驱动。',
            workflowSteps: [
                { label: '读取查找键', text: '从 {{rule_source_name}} 读取 {{lookup_key}} 作为联查键值' },
                { label: '进入数据概览表', text: '用查找键到数据概览表匹配目标资产行' },
                { label: '返回结果', text: '命中后返回 {{lookup_field}}，未命中时返回 {{default}}' }
            ],
            effectText: '保存后会直接影响当前列使用哪个字段做联查，以及最终返回哪一列资产信息。',
            dependencyTextTemplate: '依赖 {{rule_source_name}} 的查找键字段和数据概览表联查结果',
            fields: [
                { key: 'lookup_key', type: 'field_select', dataSource: 'rule_source', label: '查找键字段', required: true, description: '从当前主数据源选择一个字段，作为联查时送入数据概览表的键值。' },
                { key: 'lookup_field', type: 'field_select', dataSource: 'assets', label: '返回字段', required: true, description: '命中资产行后，当前列最终返回这个字段的值。' },
                { key: 'default', type: 'text', label: '默认值', placeholder: '未命中时返回的值', description: '如果联查失败，当前列输出这里填写的兜底值。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '补充维护说明、特殊口径或业务解释', description: '这部分文字会和规则一起保存，便于后期维护人员理解。' }
            ],
            jsonKeys: ['lookup_key', 'lookup_field', 'default', 'remarks'],
            jsonExample: {
                lookup_key: '',
                lookup_field: '',
                default: '',
                remarks: ''
            },
            summaryTemplate: '使用 {{lookup_key}} 作为查找键，返回数据概览字段 {{lookup_field}}'
        },
        vlookup_with_mapping: {
            enabled: true,
            version: '1.0',
            title: '跨表查询+映射',
            subtitle: '先经过公共配置映射，再到数据概览表联查。后续可以按 JSON 自定义为其他映射逻辑。',
            toneColor: '#0d9488',
            description: '这是“先标准化，再联查”的动态版配置查询。公共配置、步骤说明和帮助文字都可以继续通过 JSON 定义替换。',
            workflowSteps: [
                { label: '读取查找键', text: '从 {{rule_source_name}} 读取 {{lookup_key}} 作为原始查找键' },
                { label: '经过公共配置', text: '先用 {{mapping_config}} 对原始键值做名称转换，再进入数据概览表联查' },
                { label: '返回结果', text: '命中后返回 {{lookup_field}}；若未命中则按“映射未命中处理”和默认值规则输出' }
            ],
            effectText: '保存后会直接影响当前列先使用哪一个公共配置做转换，再按什么字段去数据概览表联查。',
            dependencyTextTemplate: '依赖 {{rule_source_name}}、公共配置 {{mapping_config}} 和数据概览表联查结果',
            fields: [
                { key: 'lookup_key', type: 'field_select', dataSource: 'rule_source', label: '查找键字段', required: true, description: '选择当前主数据源中的键字段，例如业务系统名称、资产名称等。' },
                { key: 'mapping_config', type: 'public_config_select', configType: 'mapping_table', label: '公共配置', required: true, description: '这里可以接任意已登记的映射类公共配置，后续不局限于“业务系统名称映射”或“资产名称映射”。' },
                { key: 'lookup_field', type: 'field_select', dataSource: 'assets', label: '返回字段', required: true, description: '映射并联查成功后，当前列最终返回的数据概览表字段。' },
                {
                    key: 'fallback_to_raw_lookup',
                    type: 'select',
                    label: '映射未命中处理',
                    valueType: 'boolean',
                    description: '控制映射后的键值没有查到时，是否再使用原始键值补查一次。',
                    options: [
                        { value: false, label: '直接返回默认值' },
                        { value: true, label: '回退原始值继续联查' }
                    ]
                },
                { key: 'default', type: 'text', label: '默认值', placeholder: '未命中时返回的值', description: '当映射和联查都没有得到结果时，当前列返回这个值。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '记录当前列的接线说明、例外情况和维护备注', description: '建议写清楚“为什么要先映射、再联查”，方便后续直接导入 JSON 时同步理解。' }
            ],
            jsonKeys: ['lookup_key', 'lookup_field', 'use_mapping', 'mapping_config', 'fallback_to_raw_lookup', 'default', 'remarks'],
            jsonExample: {
                lookup_key: '',
                lookup_field: '',
                use_mapping: true,
                mapping_config: 'business_system_name_mapping',
                fallback_to_raw_lookup: false,
                default: '',
                remarks: ''
            },
            initialValues: {
                use_mapping: true
            },
            summaryTemplate: '先使用公共配置 {{mapping_config}} 转换 {{lookup_key}}，再查询 {{lookup_field}}'
        },
        public_config_mapping: {
            enabled: true,
            version: '1.0',
            title: '公共配置直接映射',
            subtitle: '先读取当前字段值，再按公共配置映射后直接输出到当前列。',
            toneColor: '#0f766e',
            description: '适用于“当前字段值需要先标准化，再直接写回当前列”的场景，不再继续联查数据概览表。',
            workflowSteps: [
                { label: '读取源字段', text: '从 {{rule_source_name}} 读取 {{source_value}} 作为原始值' },
                { label: '经过公共配置', text: '使用 {{mapping_config}} 对原始值进行名称转换' },
                { label: '返回结果', text: '命中时直接返回映射值，未命中时按 {{fallback_policy}} 和默认值规则输出' }
            ],
            effectText: '保存后会直接影响当前列从哪个源字段取值、使用哪个公共配置映射，以及未命中时如何回填结果。',
            dependencyTextTemplate: '依赖 {{rule_source_name}} 源字段和公共配置 {{mapping_config}} 的映射结果',
            fields: [
                { key: 'source_value', type: 'field_select', dataSource: 'rule_source', label: '源字段', required: true, description: '从当前主数据源选择原始值字段，系统会对这个字段的值做公共配置转换。' },
                { key: 'mapping_config', type: 'public_config_select', configType: 'mapping_table', label: '公共配置', required: true, description: '选择要使用的映射类公共配置，例如资产名称映射、业务系统名称映射。' },
                {
                    key: 'fallback_policy',
                    type: 'select',
                    label: '未命中处理',
                    description: '控制当前值在公共配置中找不到映射结果时，当前列如何输出。',
                    options: [
                        { value: 'default', label: '返回默认值' },
                        { value: 'raw_value', label: '返回原始值' },
                        { value: 'empty', label: '返回空值' }
                    ]
                },
                { key: 'default', type: 'text', label: '默认值', placeholder: '未命中时返回的值', description: '当未命中处理选择“返回默认值”时，当前列输出这里填写的内容。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '记录当前列为什么要使用公共配置直接映射', description: '建议记录当前列的原始值来源、使用的公共配置以及未命中处理口径。' }
            ],
            jsonKeys: ['source_value', 'mapping_config', 'fallback_policy', 'default', 'remarks'],
            jsonExample: {
                source_value: '',
                mapping_config: 'asset_name_mapping',
                fallback_policy: 'default',
                default: '',
                remarks: ''
            },
            initialValues: {
                mapping_config: 'asset_name_mapping',
                fallback_policy: 'default'
            },
            summaryTemplate: '读取字段 {{source_value}}，使用公共配置 {{mapping_config}} 直接映射输出，未命中按 {{fallback_policy}} 处理'
        },
        ip_lookup: {
            enabled: true,
            version: '1.0',
            title: 'IP 查询',
            subtitle: '按 IP 从数据概览表反查其他字段。',
            toneColor: '#1d4ed8',
            description: '适用于“当前列先拿到 IP，再到数据概览表按 IP 反查资产信息”的场景。',
            workflowSteps: [
                { label: '读取 IP 字段', text: '从 {{rule_source_name}} 读取 {{source_value}} 作为反查 IP' },
                { label: '按 IP 匹配资产', text: '系统会用这个 IP 在数据概览表中查找匹配的资产记录' },
                { label: '返回目标字段', text: '命中后返回 {{lookup_field}}，未命中时返回 {{default}}' }
            ],
            effectText: '保存后会直接影响当前列使用哪个 IP 字段做反查，以及匹配成功后返回哪一个资产字段。',
            dependencyTextTemplate: '依赖 {{rule_source_name}} 的 IP 字段和数据概览表按 IP 反查结果',
            fields: [
                { key: 'source_value', type: 'field_select', dataSource: 'rule_source', label: 'IP 字段', required: true, description: '从当前主数据源中选择一个包含 IP 地址的字段。' },
                { key: 'lookup_field', type: 'field_select', dataSource: 'assets', optionValueKey: 'name', label: '返回字段', required: true, description: '这里保存的是数据概览表字段名，保持和现有 IP 查询口径一致。' },
                { key: 'default', type: 'text', label: '默认值', placeholder: '未命中时返回的值', description: '如果按 IP 没有查到对应资产，则返回这里的内容。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '例如：按主机 IP 反查所属系统类型', description: '用于补充这条 IP 反查规则的业务说明。' }
            ],
            jsonKeys: ['source_value', 'lookup_field', 'default', 'remarks'],
            jsonExample: {
                source_value: '',
                lookup_field: '',
                default: '',
                remarks: ''
            },
            summaryTemplate: '使用 IP 字段 {{source_value}} 反查数据概览字段 {{lookup_field}}'
        },
        field_assets_dynamic: {
            enabled: true,
            version: '1.0',
            title: '动态生成',
            subtitle: '按数据概览字段和策略上下文动态拼装输出文本。',
            toneColor: '#7c3aed',
            description: '适用于策略名称、策略标题等需要按业务系统上下文和策略类型动态拼接文本的场景。',
            workflowSteps: [
                { label: '读取配置参数', text: '当前配置会保存资产字段 {{source_value}} 和参考列 {{reference_column}}' },
                { label: '组合上下文', text: '导出时系统会结合当前业务系统上下文和展开出的策略类型生成动态文本' },
                { label: '写入当前列', text: '生成后的文本会直接写入当前列，影响当前报表的导出内容' }
            ],
            effectText: '保存后会直接影响当前列读取哪一个资产字段，以及按哪一个参考列参与动态文本生成。',
            dependencyTextTemplate: '依赖数据概览表字段 {{source_value}}、参考列 {{reference_column}} 和当前展开上下文',
            fields: [
                { key: 'source_value', type: 'field_select', dataSource: 'assets', label: '源字段', required: true, description: '从数据概览表中选择一个字段，作为动态文本生成时的主要输入值。' },
                { key: 'reference_column', type: 'text', label: '参考列', placeholder: '例如 D', description: '用于拼接或生成动态内容时的参考列标识，默认按现有口径使用 D。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '例如：取业务系统字段并按 D 列规则动态生成策略名称', description: '建议记录当前动态生成规则的业务说明，方便维护。' }
            ],
            jsonKeys: ['source_value', 'reference_column', 'remarks'],
            jsonExample: {
                source_value: '',
                reference_column: 'D',
                remarks: ''
            },
            summaryTemplate: '读取数据概览字段 {{source_value}}，按参考列 {{reference_column}} 生成内容'
        },
        multi_strategy_config: {
            enabled: true,
            version: '1.0',
            title: '多行展开规则',
            subtitle: '这是报表级共享配置，最终保存到 expansion_rules。',
            toneColor: '#a16207',
            saveTarget: 'config.expansion_rules',
            description: '这里维护当前报表的展开策略定义。每一个 strategy key 都会成为一类可展开策略，并同时影响对应的策略内容映射。',
            workflowSteps: [
                { label: '定义策略类型', text: '你在 expansion_rules 中定义的每一个 key，都会成为一类展开策略' },
                { label: '展开记录', text: 'multi_strategy_config 会按这些规则把一条源记录展开成多条策略记录，并把策略类型写入对应列' },
                { label: '联动内容', text: '同一套 expansion_rules 还会同步影响 strategy_content_mapping 的返回内容' }
            ],
            effectText: '保存后会直接影响当前报表的多行展开结果，并同步影响策略内容映射所使用的策略定义。',
            dependencyTextTemplate: '依赖当前报表的 expansion_rules，共 {{expansion_rule_count}} 类策略',
            fields: [
                { type: 'info', title: '报表级共享规则', text: '该配置保存到当前报表的 expansion_rules，建议在 JSON 编辑区维护完整结构。' }
            ],
            jsonKeys: ['expansion_rules'],
            jsonExample: {
                expansion_rules: {}
            },
            summaryTemplate: '当前维护多行展开规则，共 {{expansion_rule_count}} 类策略，入口角色为 {{expansion_role_label}}'
        },
        strategy_content_mapping: {
            enabled: true,
            version: '1.0',
            title: '策略内容映射',
            subtitle: '这是报表级共享配置，最终保存到 expansion_rules。',
            toneColor: '#b45309',
            saveTarget: 'config.expansion_rules',
            description: '这里维护当前报表按策略类型返回内容文本所依赖的共享规则。底层仍然是同一套 expansion_rules。',
            workflowSteps: [
                { label: '读取策略类型', text: '当前列会读取 multi_strategy_config 展开出来的策略类型 key' },
                { label: '映射内容', text: 'strategy_content_mapping 会根据 strategy key，从 expansion_rules 中返回对应内容文本' },
                { label: '共享维护', text: '你在这里的修改，也会同步影响多行展开使用的同一套策略定义' }
            ],
            effectText: '保存后会直接影响当前报表按策略类型返回什么内容文本，并同步影响多行展开共用的策略规则定义。',
            dependencyTextTemplate: '依赖当前报表的 expansion_rules，共 {{expansion_rule_count}} 类策略',
            fields: [
                { type: 'info', title: '报表级共享规则', text: '该配置保存到当前报表的 expansion_rules，建议在 JSON 编辑区维护完整结构。' }
            ],
            jsonKeys: ['expansion_rules'],
            jsonExample: {
                expansion_rules: {}
            },
            summaryTemplate: '当前维护策略内容映射，共 {{expansion_rule_count}} 类策略，入口角色为 {{expansion_role_label}}'
        },
        data_sample_mapper: {
            enabled: true,
            version: '1.0',
            title: '数据样例映射',
            subtitle: '按“数据名称”匹配标准样例，决定最终脱敏后的导出值。',
            toneColor: '#4f46e5',
            description: '适用于根据“数据名称”自动去样例标准库中查标准记录，再按标准记录自身分级处理样例值的场景。',
            workflowSteps: [
                { label: '读取数据名称', text: '当前从 {{rule_source_name}} 读取 {{name_column_index}} 作为匹配键' },
                { label: '匹配样例标准', text: '系统会用该数据名称去“数据分级标准样例”中查找标准记录，同时读取该标准记录自己的 level' },
                { label: '按分级处理样例', text: 'level 1-2 原样返回，level 3 做脱敏，level 4 及以上按加密口径处理后再写入当前列' }
            ],
            effectText: '保存后会直接影响当前列读取哪一个“数据名称”字段去匹配样例标准，以及最终原样、脱敏或加密后的导出值。',
            dependencyTextTemplate: '依赖 {{rule_source_name}} 的数据名称字段，以及“数据分级标准样例”的匹配结果',
            fields: [
                { key: 'name_column_index', type: 'field_select', dataSource: 'rule_source', label: '数据名称字段', required: true, description: '系统会用这个字段的值去“数据分级标准样例”中查标准记录。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '例如：取数据名称列，从数据分级标准样例中自动获取样例', description: '建议补充当前样例映射的业务用途和维护说明。' }
            ],
            jsonKeys: ['name_column_index', 'remarks'],
            jsonExample: {
                name_column_index: '',
                remarks: ''
            },
            summaryTemplate: '使用字段 {{name_column_index}} 作为数据名称去匹配样例标准'
        },
        column_value_count: {
            enabled: true,
            version: '1.0',
            title: '列值统计',
            subtitle: '统计当前导出数据集中某一字段值的出现次数。',
            toneColor: '#15803d',
            description: '适用于按当前导出数据集实时统计某一字段值出现频次，并把计数写回当前列的场景。',
            workflowSteps: [
                { label: '选定统计键', text: '当前从 {{rule_source_name}} 读取 {{source_value}} 的值作为统计键' },
                { label: '预统计全量数据', text: '导出前，系统会基于当前导出数据集的全量记录先做一次值频次统计' },
                { label: '回填当前列', text: '当前行会用自己的统计键去频次结果中查值，再把出现次数写回当前列' }
            ],
            effectText: '保存后会直接影响当前列统计哪一个字段的值，并影响导出文件中的计数结果。',
            dependencyTextTemplate: '依赖当前导出数据集的全量频次统计结果，统计字段为 {{source_value}}',
            fields: [
                { key: 'source_value', type: 'field_select', dataSource: 'rule_source', label: '统计字段', required: true, description: '系统会统计这个字段当前值在本次导出数据集中的出现次数。' },
                { key: 'remarks', type: 'textarea', label: '备注', rows: 3, placeholder: '例如：统计数据名称列在本次导出数据集中重复出现的次数', description: '建议写清楚当前统计口径，避免和全库统计混淆。' }
            ],
            jsonKeys: ['source_value', 'remarks'],
            jsonExample: {
                source_value: '',
                remarks: ''
            },
            summaryTemplate: '统计字段 {{source_value}} 在当前导出数据集中的出现次数'
        }
    };

    function deepClone(value) {
        return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeShowToast(message, isError) {
        if (typeof showToast === 'function') {
            showToast(message, isError === true);
            return;
        }
        if (isError) {
            console.error(message);
            return;
        }
        console.log(message);
    }

    function getThreeLayerArchitecture() {
        try {
            if (typeof ThreeLayerArchitecture !== 'undefined') {
                return ThreeLayerArchitecture;
            }
        } catch (error) {
            console.warn('[DynamicConfigQuery] 获取 ThreeLayerArchitecture 失败:', error);
        }
        return global.ThreeLayerArchitecture || null;
    }

    function normalizeSourceType(sourceType) {
        const architecture = getThreeLayerArchitecture();
        if (!sourceType) {
            return '';
        }
        if (architecture && typeof architecture.convertToNewType === 'function') {
            return architecture.convertToNewType(sourceType);
        }
        return String(sourceType).trim();
    }

    function normalizeField(field, index) {
        if (!field || typeof field !== 'object') {
            return null;
        }
        const key = String(field.key || field.name || '').trim();
        const type = String(field.type || 'text').trim() || 'text';
        return {
            key,
            name: key,
            type,
            label: String(field.label || key || `字段${index + 1}`).trim(),
            placeholder: String(field.placeholder || '').trim(),
            required: field.required === true,
            rows: Number(field.rows || 4),
            dataSource: field.dataSource || field.data_source || '',
            configType: field.configType || field.config_type || '',
            options: Array.isArray(field.options) ? deepClone(field.options) : [],
            valueType: field.valueType || field.value_type || '',
            title: String(field.title || '').trim(),
            text: String(field.text || '').trim(),
            description: String(field.description || '').trim(),
            defaultValue: field.defaultValue !== undefined ? field.defaultValue : field.default_value,
            optionValueKey: String(field.optionValueKey || field.option_value_key || 'index').trim(),
            transient: field.transient === true,
            action: String(field.action || '').trim(),
            runtimeValueResolver: String(field.runtimeValueResolver || field.runtime_value_resolver || '').trim(),
            visibleWhen: field.visibleWhen && typeof field.visibleWhen === 'object'
                ? deepClone(field.visibleWhen)
                : null
        };
    }

    function normalizeDefinition(sourceType, definition) {
        const normalizedSourceType = normalizeSourceType(sourceType);
        const clonedDefinition = deepClone(definition || {}) || {};
        const fields = Array.isArray(clonedDefinition.fields)
            ? clonedDefinition.fields.map(normalizeField).filter(Boolean)
            : [];

        return {
            enabled: clonedDefinition.enabled === true,
            version: String(clonedDefinition.version || '1.0').trim(),
            title: String(clonedDefinition.title || normalizedSourceType || '动态配置查询').trim(),
            subtitle: String(clonedDefinition.subtitle || '').trim(),
            toneColor: String(clonedDefinition.toneColor || '#0f4fa8').trim(),
            fields,
            summaryTemplate: String(clonedDefinition.summaryTemplate || '').trim(),
            jsonKeys: Array.isArray(clonedDefinition.jsonKeys)
                ? clonedDefinition.jsonKeys.map(item => String(item || '').trim()).filter(Boolean)
                : [],
            jsonExample: clonedDefinition.jsonExample && typeof clonedDefinition.jsonExample === 'object'
                ? deepClone(clonedDefinition.jsonExample)
                : {},
            initialValues: clonedDefinition.initialValues && typeof clonedDefinition.initialValues === 'object'
                ? deepClone(clonedDefinition.initialValues)
                : {},
            saveTarget: String(clonedDefinition.saveTarget || 'rule').trim() || 'rule',
            description: String(clonedDefinition.description || '').trim(),
            effectText: String(clonedDefinition.effectText || '').trim(),
            dependencyTextTemplate: String(clonedDefinition.dependencyTextTemplate || '').trim(),
            workflowSteps: Array.isArray(clonedDefinition.workflowSteps) ? deepClone(clonedDefinition.workflowSteps) : []
        };
    }

    function syncDefinitionToArchitecture(sourceType) {
        const architecture = getThreeLayerArchitecture();
        if (!architecture || typeof architecture.registerDynamicConfigQuery !== 'function') {
            return;
        }
        const definition = DYNAMIC_QUERY_STATE.definitions[sourceType];
        if (!definition) {
            return;
        }
        architecture.registerDynamicConfigQuery(sourceType, definition);
    }

    function registerDefinition(sourceType, definition) {
        const normalizedSourceType = normalizeSourceType(sourceType);
        if (!normalizedSourceType) {
            return null;
        }
        const normalizedDefinition = normalizeDefinition(normalizedSourceType, definition);
        DYNAMIC_QUERY_STATE.definitions[normalizedSourceType] = normalizedDefinition;
        syncDefinitionToArchitecture(normalizedSourceType);
        return deepClone(normalizedDefinition);
    }

    function getDefinition(sourceType) {
        const normalizedSourceType = normalizeSourceType(sourceType);
        const definition = DYNAMIC_QUERY_STATE.definitions[normalizedSourceType];
        return definition ? deepClone(definition) : null;
    }

    function listDefinitions() {
        return Object.keys(DYNAMIC_QUERY_STATE.definitions).reduce((accumulator, sourceType) => {
            accumulator[sourceType] = deepClone(DYNAMIC_QUERY_STATE.definitions[sourceType]);
            return accumulator;
        }, {});
    }

    function exportDefinitions() {
        return {
            version: '1.0',
            exported_at: new Date().toISOString(),
            definitions: listDefinitions()
        };
    }

    function toJSON() {
        return JSON.stringify(exportDefinitions(), null, 2);
    }

    function normalizeImportPayload(payload) {
        const rawPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (!rawPayload || typeof rawPayload !== 'object') {
            throw new Error('动态配置查询定义格式无效');
        }

        if (rawPayload.definitions && typeof rawPayload.definitions === 'object') {
            return rawPayload.definitions;
        }
        if (Array.isArray(rawPayload.definitions)) {
            return rawPayload.definitions.reduce((accumulator, item) => {
                const sourceType = String(item?.sourceType || item?.source_type || item?.key || '').trim();
                if (sourceType) {
                    accumulator[sourceType] = item.definition || item;
                }
                return accumulator;
            }, {});
        }
        return rawPayload;
    }

    function importDefinitions(payload) {
        const definitions = normalizeImportPayload(payload);
        Object.keys(definitions).forEach(sourceType => {
            registerDefinition(sourceType, definitions[sourceType]);
        });
        return listDefinitions();
    }

    function replaceDefinitions(payload) {
        const previousKeys = Object.keys(DYNAMIC_QUERY_STATE.definitions);
        previousKeys.forEach(sourceType => {
            DYNAMIC_QUERY_STATE.definitions[sourceType] = normalizeDefinition(sourceType, { enabled: false });
            syncDefinitionToArchitecture(sourceType);
            delete DYNAMIC_QUERY_STATE.definitions[sourceType];
        });
        return importDefinitions(payload);
    }

    function hasDefinitions() {
        return Object.keys(DYNAMIC_QUERY_STATE.definitions).length > 0;
    }

    function setDefinitionEnabled(sourceType, enabled) {
        const normalizedSourceType = normalizeSourceType(sourceType);
        const nextDefinition = normalizeDefinition(
            normalizedSourceType,
            Object.assign({}, DYNAMIC_QUERY_STATE.definitions[normalizedSourceType] || {}, {
                enabled: enabled === true
            })
        );
        DYNAMIC_QUERY_STATE.definitions[normalizedSourceType] = nextDefinition;
        syncDefinitionToArchitecture(normalizedSourceType);
        return deepClone(nextDefinition);
    }

    function getCurrentMappingConfigSafely() {
        try {
            if (currentMappingConfig && typeof currentMappingConfig === 'object') {
                return currentMappingConfig;
            }
        } catch (error) {}
        return global.currentMappingConfigData || null;
    }

    function resolveCurrentReportDataSource(config) {
        try {
            if (typeof resolveEffectiveMappingDataSource === 'function') {
                return resolveEffectiveMappingDataSource(config || getCurrentMappingConfigSafely());
            }
        } catch (error) {}
        return (config && config.data_source) || 'merge_results';
    }

    function resolveRuleDataSource(rule, config) {
        try {
            if (typeof resolveRuleSourceDataSource === 'function') {
                return resolveRuleSourceDataSource(rule || {}, config || getCurrentMappingConfigSafely());
            }
        } catch (error) {}
        return resolveCurrentReportDataSource(config);
    }

    function resolveDataSourceToken(dataSource, rule, config) {
        const token = String(dataSource || '').trim();
        if (!token) {
            return resolveCurrentReportDataSource(config);
        }
        if (token === 'rule_source' || token === 'current_rule_source') {
            return resolveRuleDataSource(rule, config);
        }
        if (token === 'current_report_source' || token === 'current_mapping_source') {
            return resolveCurrentReportDataSource(config);
        }
        return token;
    }

    function getIndexedColumns(dataSource, config, rule) {
        const resolvedDataSource = resolveDataSourceToken(dataSource, rule, config);
        try {
            if (typeof getIndexedDataSourceColumns === 'function') {
                return getIndexedDataSourceColumns(resolvedDataSource, config || getCurrentMappingConfigSafely());
            }
        } catch (error) {
            console.warn('[DynamicConfigQuery] 获取字段列表失败:', error);
        }

        const rawColumns = Array.isArray((global.currentDataSourceColumns || {})[resolvedDataSource])
            ? global.currentDataSourceColumns[resolvedDataSource]
            : [];

        return rawColumns.map((column, index) => {
            const columnObject = column && typeof column === 'object' ? column : { name: column };
            return {
                ...columnObject,
                index: columnObject.index !== undefined ? columnObject.index : index,
                name: columnObject.name || columnObject.field_name || String(column || ''),
                display_name: columnObject.display_name || `索引${columnObject.index !== undefined ? columnObject.index : index}: ${columnObject.name || column || ''}`
            };
        });
    }

    function resolveFieldValueType(field) {
        if (field.valueType) {
            return field.valueType;
        }
        if (field.type === 'field_select') {
            return 'number';
        }
        if (field.type === 'checkbox') {
            return 'boolean';
        }
        return '';
    }

    function toTypedFieldValue(rawValue, field) {
        const valueType = resolveFieldValueType(field);
        if (valueType === 'boolean') {
            if (typeof rawValue === 'boolean') {
                return rawValue;
            }
            return String(rawValue) === 'true';
        }
        if (valueType === 'number') {
            if (rawValue === '' || rawValue === null || rawValue === undefined) {
                return '';
            }
            const numericValue = Number(rawValue);
            return Number.isFinite(numericValue) ? numericValue : rawValue;
        }
        return rawValue;
    }

    function getFieldDomId(field) {
        return `dynamicConfigQueryField_${String(field.key || field.name || '').replace(/[^a-zA-Z0-9_]/g, '_')}`;
    }

    function formatColumnOptionLabel(column, fallbackValue = '') {
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

    function buildColumnOptionsHtml(columns, selectedValue, valueKey = 'index') {
        const currentValue = String(selectedValue === undefined || selectedValue === null ? '' : selectedValue);
        const optionsHtml = (columns || []).map(column => {
            const rawOptionValue = valueKey === 'name'
                ? (column.name || column.field_name || '')
                : column.index;
            const optionValue = String(rawOptionValue);
            const selected = currentValue !== '' && (
                currentValue === optionValue
                || currentValue === String(column.name || '')
            ) ? 'selected' : '';
            return `<option value="${escapeHtml(optionValue)}" ${selected}>${escapeHtml(formatColumnOptionLabel(column, optionValue))}</option>`;
        });

        if (currentValue && !(columns || []).some(column => currentValue === String(valueKey === 'name' ? (column.name || column.field_name || '') : column.index) || currentValue === String(column.name || ''))) {
            const fallbackLabel = /^-?\d+$/.test(currentValue.trim())
                ? `索引${currentValue.trim()}: 当前配置值（字段名未加载）`
                : `${currentValue}（当前配置值）`;
            optionsHtml.unshift(`<option value="${escapeHtml(currentValue)}" selected>${escapeHtml(fallbackLabel)}</option>`);
        }

        return optionsHtml.join('');
    }

    function getAvailablePublicConfigOptions(field, selectedValue) {
        const configType = String(field.configType || 'mapping_table').trim();
        let options = [];

        try {
            if (typeof getAvailablePublicMappingConfigs === 'function') {
                options = getAvailablePublicMappingConfigs();
            }
        } catch (error) {
            console.warn('[DynamicConfigQuery] 获取公共配置列表失败:', error);
        }

        if ((!options || options.length === 0) && Array.isArray(global.publicConfigCenterData)) {
            options = global.publicConfigCenterData;
        }

        const filteredOptions = (options || []).filter(item => {
            if (!item || !item.key || item.enabled === false) {
                return false;
            }
            const itemConfigType = String(item.config_type || item.type || 'mapping_table').trim();
            return !configType || itemConfigType === configType;
        });

        const normalizedSelectedValue = String(selectedValue || '').trim();
        const optionHtml = filteredOptions.map(item => {
            const key = String(item.key || '').trim();
            const name = item.name || item.title || key;
            const selected = normalizedSelectedValue === key ? 'selected' : '';
            return `<option value="${escapeHtml(key)}" ${selected}>${escapeHtml(name)}（${escapeHtml(key)}）</option>`;
        });

        if (normalizedSelectedValue && !filteredOptions.some(item => String(item.key || '').trim() === normalizedSelectedValue)) {
            optionHtml.unshift(`<option value="${escapeHtml(normalizedSelectedValue)}" selected>${escapeHtml(normalizedSelectedValue)}（当前值）</option>`);
        }

        return optionHtml.join('');
    }

    function buildSelectOptionsHtml(field, selectedValue) {
        const selectedString = String(selectedValue === undefined || selectedValue === null ? '' : selectedValue);
        return (field.options || []).map(option => {
            const optionObject = option && typeof option === 'object'
                ? option
                : { value: option, label: option };
            const optionValue = optionObject.value;
            const selected = selectedString === String(optionValue) ? 'selected' : '';
            return `<option value="${escapeHtml(String(optionValue))}" ${selected}>${escapeHtml(optionObject.label || optionValue)}</option>`;
        }).join('');
    }

    function getSingleConditionalTemplatePresetsSafe() {
        try {
            if (typeof getSingleConditionalTemplatePresets === 'function') {
                return getSingleConditionalTemplatePresets();
            }
        } catch (error) {}
        return SINGLE_CONDITIONAL_TEMPLATE_PRESETS;
    }

    function detectSingleConditionalTemplateIdSafe(conditions, defaultVal) {
        try {
            if (typeof detectSingleConditionalTemplateId === 'function') {
                return detectSingleConditionalTemplateId(conditions || [], defaultVal || '');
            }
        } catch (error) {}
        const presets = getSingleConditionalTemplatePresetsSafe();
        const normalizedConditions = JSON.stringify(Array.isArray(conditions) ? conditions : []);
        return Object.entries(presets).find(([, preset]) => (
            normalizedConditions === JSON.stringify(preset.conditions || [])
            && String(defaultVal || '') === String(preset.default || '')
        ))?.[0] || '';
    }

    function detectMultiConditionalModeSafe(config, rule) {
        const resolvedConfig = config && typeof config === 'object' ? config : {};
        if (resolvedConfig.__dynamic_mode === 'groups' || resolvedConfig.__dynamic_mode === 'simple') {
            return resolvedConfig.__dynamic_mode;
        }
        if (Array.isArray(resolvedConfig.groups)) {
            return 'groups';
        }
        if (Array.isArray(rule?.groups) && rule.groups.length > 0) {
            return 'groups';
        }
        if (rule?.source_type === 'conditional_groups') {
            return 'groups';
        }
        return 'simple';
    }

    function resolveRuntimeFieldValue(field, workingConfig, config, rule) {
        if (field.transient === true && Object.prototype.hasOwnProperty.call(DYNAMIC_QUERY_STATE.transientValues, field.key)) {
            return DYNAMIC_QUERY_STATE.transientValues[field.key];
        }
        if (!field.runtimeValueResolver) {
            return undefined;
        }
        if (field.runtimeValueResolver === 'detect_single_conditional_template') {
            const conditions = Array.isArray(workingConfig?.conditions)
                ? workingConfig.conditions
                : Array.isArray(rule?.conditions)
                    ? rule.conditions
                    : [];
            const defaultVal = workingConfig?.default !== undefined
                ? workingConfig.default
                : (rule?.default || '');
            return detectSingleConditionalTemplateIdSafe(conditions, defaultVal);
        }
        if (field.runtimeValueResolver === 'detect_multi_conditional_mode') {
            return detectMultiConditionalModeSafe(workingConfig, rule);
        }
        return undefined;
    }

    function getFieldCurrentValue(field, workingConfig, config, rule) {
        if (!workingConfig || typeof workingConfig !== 'object') {
            const runtimeValue = resolveRuntimeFieldValue(field, workingConfig, config, rule);
            if (runtimeValue !== undefined) {
                return runtimeValue;
            }
            return field.defaultValue !== undefined ? field.defaultValue : '';
        }
        if (Object.prototype.hasOwnProperty.call(workingConfig, field.key)) {
            return workingConfig[field.key];
        }
        const runtimeValue = resolveRuntimeFieldValue(field, workingConfig, config, rule);
        if (runtimeValue !== undefined) {
            return runtimeValue;
        }
        return field.defaultValue !== undefined ? field.defaultValue : '';
    }

    function getVisibleStateValue(key, context, workingConfig) {
        const targetField = (context.definition.fields || []).find(field => field.key === key);
        if (targetField) {
            const element = document.getElementById(getFieldDomId(targetField));
            if (element) {
                return targetField.type === 'checkbox' ? element.checked : element.value;
            }
            return getFieldCurrentValue(targetField, workingConfig, context.config, context.rule);
        }
        return workingConfig ? workingConfig[key] : undefined;
    }

    function isFieldVisible(field, context, workingConfig) {
        if (!field.visibleWhen) {
            return true;
        }
        const currentValue = getVisibleStateValue(field.visibleWhen.field, context, workingConfig);
        if (Object.prototype.hasOwnProperty.call(field.visibleWhen, 'equals')) {
            return String(currentValue) === String(field.visibleWhen.equals);
        }
        if (Object.prototype.hasOwnProperty.call(field.visibleWhen, 'notEquals')) {
            return String(currentValue) !== String(field.visibleWhen.notEquals);
        }
        return true;
    }

    function renderFieldControl(field, workingConfig, config, rule) {
        const currentValue = getFieldCurrentValue(field, workingConfig, config, rule);
        const inputId = getFieldDomId(field);
        const requiredText = field.required ? '<span style="color: #dc2626;">*</span>' : '';

        if (field.type === 'info') {
            return `
                <div style="padding: 14px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px;">
                    ${field.title ? `<div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">${escapeHtml(field.title)}</div>` : ''}
                    <div style="font-size: 13px; color: #475569; line-height: 1.8;">${escapeHtml(field.text || field.description || '')}</div>
                </div>
            `;
        }

        let controlHtml = '';
        let extraHintHtml = field.description
            ? `<div style="margin-top: 6px; font-size: 12px; color: #64748b; line-height: 1.7;">${escapeHtml(field.description)}</div>`
            : '';

        if (field.type === 'textarea') {
            controlHtml = `
                <textarea
                    id="${inputId}"
                    data-dynamic-config-field="true"
                    data-field-key="${escapeHtml(field.key)}"
                    rows="${Math.max(3, field.rows || 4)}"
                    style="width: 100%; min-height: 92px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; resize: vertical;"
                    placeholder="${escapeHtml(field.placeholder || '')}"
                    oninput="DynamicConfigQueryManager.handleFieldChange(this.dataset.fieldKey)"
                >${escapeHtml(currentValue)}</textarea>
            `;
        } else if (field.type === 'select') {
            controlHtml = `
                <select
                    id="${inputId}"
                    data-dynamic-config-field="true"
                    data-field-key="${escapeHtml(field.key)}"
                    style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;"
                    onchange="DynamicConfigQueryManager.handleFieldChange(this.dataset.fieldKey)"
                >
                    <option value="">请选择</option>
                    ${buildSelectOptionsHtml(field, currentValue)}
                </select>
            `;
        } else if (field.type === 'field_select') {
            const columns = getIndexedColumns(field.dataSource, config, rule);
            controlHtml = `
                <select
                    id="${inputId}"
                    data-dynamic-config-field="true"
                    data-field-key="${escapeHtml(field.key)}"
                    style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;"
                    onchange="DynamicConfigQueryManager.handleFieldChange(this.dataset.fieldKey)"
                >
                    <option value="">请选择字段</option>
                    ${buildColumnOptionsHtml(columns, currentValue, field.optionValueKey || 'index')}
                </select>
            `;
            try {
                if (typeof getIndexHintText === 'function') {
                    extraHintHtml += `<div style="margin-top: 6px; font-size: 12px; color: #64748b;">${escapeHtml(getIndexHintText(resolveDataSourceToken(field.dataSource, rule, config), config))}</div>`;
                }
            } catch (error) {}
        } else if (field.type === 'public_config_select') {
            controlHtml = `
                <select
                    id="${inputId}"
                    data-dynamic-config-field="true"
                    data-field-key="${escapeHtml(field.key)}"
                    style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;"
                    onchange="DynamicConfigQueryManager.handleFieldChange(this.dataset.fieldKey)"
                >
                    <option value="">请选择公共配置</option>
                    ${getAvailablePublicConfigOptions(field, currentValue)}
                </select>
            `;
        } else if (field.type === 'checkbox') {
            const checked = currentValue === true ? 'checked' : '';
            return `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155;">
                    <input
                        id="${inputId}"
                        type="checkbox"
                        data-dynamic-config-field="true"
                        data-field-key="${escapeHtml(field.key)}"
                        ${checked}
                        onchange="DynamicConfigQueryManager.handleFieldChange(this.dataset.fieldKey)"
                    >
                    <span>${escapeHtml(field.label || field.key)}${requiredText}</span>
                </label>
                ${extraHintHtml}
            `;
        } else {
            controlHtml = `
                <input
                    id="${inputId}"
                    type="${field.type === 'number' ? 'number' : 'text'}"
                    data-dynamic-config-field="true"
                    data-field-key="${escapeHtml(field.key)}"
                    value="${escapeHtml(currentValue)}"
                    style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;"
                    placeholder="${escapeHtml(field.placeholder || '')}"
                    oninput="DynamicConfigQueryManager.handleFieldChange(this.dataset.fieldKey)"
                >
            `;
        }

        return `
            <div style="display: grid; gap: 8px;">
                <label for="${inputId}" style="font-size: 13px; font-weight: 700; color: #334155;">${escapeHtml(field.label || field.key)}${requiredText}</label>
                ${controlHtml}
                ${extraHintHtml}
            </div>
        `;
    }

    function renderModuleFieldsHtml(context, workingConfig) {
        return (context.definition.fields || [])
            .filter(field => isFieldVisible(field, context, workingConfig))
            .map(field => renderFieldControl(field, workingConfig, context.config, context.rule))
            .join('');
    }

    function getWorkingConfigForContext(context) {
        if (!context) {
            return {};
        }

        const definition = context.definition || {};
        if (definition.saveTarget === 'config.expansion_rules') {
            const expansionRules = context.config && typeof context.config === 'object'
                ? context.config.expansion_rules
                : {};
            return {
                expansion_rules: deepClone(expansionRules || {})
            };
        }

        const baseConfig = Object.assign(
            {},
            deepClone(definition.jsonExample || {}),
            deepClone(definition.initialValues || {})
        );
        const currentRule = context.rule && typeof context.rule === 'object' ? context.rule : {};
        const editableKeys = new Set(
            (definition.fields || [])
                .filter(field => field.key)
                .filter(field => field.transient !== true)
                .map(field => field.key)
                .concat(definition.jsonKeys || [])
        );

        editableKeys.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(currentRule, key)) {
                baseConfig[key] = deepClone(currentRule[key]);
            }
        });

        if (!Object.prototype.hasOwnProperty.call(baseConfig, 'use_mapping') && currentRule.use_mapping === true) {
            baseConfig.use_mapping = true;
        }

        return baseConfig;
    }

    function buildModuleHtml(context) {
        const workingConfig = getWorkingConfigForContext(context);
        return `
            <div id="dynamicConfigQueryForm" style="display: grid; gap: 16px;">
                ${renderModuleFieldsHtml(context, workingConfig)}
            </div>
        `;
    }

    function buildJsonEditorHtml(context) {
        const workingConfig = getWorkingConfigForContext(context);
        return `
            <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap;">
                    <div style="font-size: 12px; color: #64748b; line-height: 1.7;">这里展示当前动态配置的 JSON，可用于导入自定义结构或直接调整复杂参数。</div>
                    <button type="button" onclick="DynamicConfigQueryManager.applyJsonToForm()" style="padding: 7px 14px; border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; color: #334155; font-size: 12px; cursor: pointer;">将 JSON 回填到表单</button>
                </div>
                <textarea
                    id="dynamicConfigQueryJsonConfig"
                    style="width: 100%; min-height: 320px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 12px; font-family: 'Consolas', 'Monaco', monospace; line-height: 1.7; resize: vertical;"
                    oninput="DynamicConfigQueryManager.markJsonDirty()"
                >${escapeHtml(JSON.stringify(workingConfig, null, 2))}</textarea>
                <div id="dynamicConfigQueryJsonStatus" style="font-size: 12px; color: #64748b;">JSON 与表单保持同步</div>
            </div>
        `;
    }

    function collectFormValuesFromDom(definition) {
        const values = {};
        const missingLabels = [];

        (definition.fields || []).forEach(field => {
            if (!field.key || field.type === 'info' || field.transient === true) {
                return;
            }

            const element = document.getElementById(getFieldDomId(field));
            if (!element) {
                return;
            }

            let rawValue;
            if (field.type === 'checkbox') {
                rawValue = element.checked;
            } else {
                rawValue = element.value;
            }

            const typedValue = toTypedFieldValue(rawValue, field);
            values[field.key] = typedValue;

            if (!field.required) {
                return;
            }

            const emptyValue = typedValue === '' || typedValue === null || typedValue === undefined;
            if (emptyValue) {
                missingLabels.push(field.label || field.key);
            }
        });

        return {
            values,
            missingLabels
        };
    }

    function getJsonEditorElement() {
        return document.getElementById('dynamicConfigQueryJsonConfig');
    }

    function setJsonStatus(text, color) {
        const statusElement = document.getElementById('dynamicConfigQueryJsonStatus');
        if (!statusElement) {
            return;
        }
        statusElement.textContent = text;
        statusElement.style.color = color || '#64748b';
    }

    function getJsonEditorBaseValue(context) {
        const jsonElement = getJsonEditorElement();
        if (!jsonElement) {
            return null;
        }
        try {
            return JSON.parse(jsonElement.value || '{}');
        } catch (error) {
            return null;
        }
    }

    function syncJsonFromForm() {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            return;
        }

        const jsonElement = getJsonEditorElement();
        if (!jsonElement) {
            return;
        }

        const { values } = collectFormValuesFromDom(context.definition);
        const workingConfig = getJsonEditorBaseValue(context) || getWorkingConfigForContext(context);
        const merged = Object.assign({}, workingConfig, values);
        jsonElement.value = JSON.stringify(merged, null, 2);
        DYNAMIC_QUERY_STATE.jsonDirty = false;
        setJsonStatus('JSON 与表单保持同步', '#64748b');
        refreshTransientFieldValues();
        refreshPreviewIfVisible();
    }

    function markJsonDirty() {
        DYNAMIC_QUERY_STATE.jsonDirty = true;
        setJsonStatus('已检测到 JSON 手动修改，保存时会以 JSON 为准', '#b45309');
        refreshPreviewIfVisible();
    }

    function parseJsonEditor() {
        const jsonElement = getJsonEditorElement();
        if (!jsonElement) {
            return {};
        }
        return JSON.parse(jsonElement.value || '{}');
    }

    function applyJsonToForm() {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            return;
        }

        let parsedConfig;
        try {
            parsedConfig = parseJsonEditor();
        } catch (error) {
            safeShowToast(`JSON 解析失败：${error.message}`, true);
            setJsonStatus(`JSON 解析失败：${error.message}`, '#dc2626');
            return;
        }
        DYNAMIC_QUERY_STATE.transientValues = {};
        DYNAMIC_QUERY_STATE.jsonDirty = false;
        setJsonStatus('JSON 已回填到表单', '#15803d');
        refreshModuleForm();
    }

    function refreshPreviewIfVisible() {
        try {
            if (typeof refreshAdvancedCodePreviewIfVisible === 'function') {
                refreshAdvancedCodePreviewIfVisible();
            }
        } catch (error) {}
    }

    function buildTemplateReplacements(definition, data, context) {
        const resolvedData = data && typeof data === 'object' ? data : {};
        const fields = Array.isArray(definition.fields) ? definition.fields : [];
        const replacements = {
            rule_source_name: context?.ruleSourceName || '当前数据源',
            assets_source_name: '数据概览表',
            transform: String(resolvedData.transform || context?.rule?.transform || '无'),
            condition_count: String(Array.isArray(resolvedData.conditions)
                ? resolvedData.conditions.length
                : Array.isArray(context?.rule?.conditions)
                    ? context.rule.conditions.length
                    : 0),
            group_count: String(Array.isArray(resolvedData.groups)
                ? resolvedData.groups.length
                : Array.isArray(context?.rule?.groups)
                    ? context.rule.groups.length
                    : 0),
            default: resolvedData.default === '' || resolvedData.default === undefined || resolvedData.default === null
                ? '空值'
                : String(resolvedData.default),
            remarks: resolvedData.remarks === '' || resolvedData.remarks === undefined || resolvedData.remarks === null
                ? '未填写'
                : String(resolvedData.remarks)
        };

        fields.forEach(field => {
            if (!field.key) {
                return;
            }
            let displayValue = resolvedData[field.key];

            if (field.type === 'field_select' && displayValue !== '' && displayValue !== undefined && displayValue !== null) {
                const columns = getIndexedColumns(field.dataSource, context.config, context.rule);
                const matchedColumn = (columns || []).find(column => {
                    const compareValue = field.optionValueKey === 'name'
                        ? String(column.name || column.field_name || '')
                        : String(column.index);
                    return compareValue === String(displayValue)
                        || String(column.name || '') === String(displayValue);
                });
                displayValue = matchedColumn ? (matchedColumn.display_name || matchedColumn.name || displayValue) : displayValue;
            }

            if (field.type === 'public_config_select' && displayValue) {
                let matchedConfig = null;
                try {
                    const options = typeof getAvailablePublicMappingConfigs === 'function'
                        ? getAvailablePublicMappingConfigs()
                        : [];
                    matchedConfig = (options || []).find(item => String(item.key || '') === String(displayValue));
                } catch (error) {}
                displayValue = matchedConfig ? (matchedConfig.name || matchedConfig.title || matchedConfig.key) : displayValue;
            }

            if (field.type === 'select' && displayValue !== '' && displayValue !== undefined && displayValue !== null) {
                const matchedOption = (field.options || []).find(option => {
                    const optionObject = option && typeof option === 'object'
                        ? option
                        : { value: option, label: option };
                    return String(optionObject.value) === String(displayValue);
                });
                if (matchedOption) {
                    displayValue = matchedOption.label || matchedOption.value || displayValue;
                }
            }

            replacements[field.key] = displayValue === '' || displayValue === undefined || displayValue === null
                ? '未设置'
                : String(displayValue);
        });

        replacements.mapping_config_name = replacements.mapping_config || '未设置';
        replacements.expansion_role_label = context?.sourceType === 'strategy_content_mapping'
            ? '策略内容映射'
            : '多行展开';
        replacements.multi_mode = detectMultiConditionalModeSafe(resolvedData, context?.rule);
        replacements.multi_mode_label = replacements.multi_mode === 'groups' ? '条件组模式' : '简单模式';
        replacements.condition_or_group_summary = replacements.multi_mode === 'groups'
            ? `共 ${replacements.group_count} 个条件组，组间逻辑为 ${resolvedData.group_logic || context?.rule?.group_logic || 'OR'}`
            : `共 ${replacements.condition_count} 条条件，联合逻辑为 ${resolvedData.logic || context?.rule?.logic || 'AND'}`;
        replacements.multi_mode_description = replacements.multi_mode === 'groups'
            ? '每组内部固定按 AND 判断，各组独立命中后，再按 group_logic 汇总结果'
            : `conditions 列表按 ${resolvedData.logic || context?.rule?.logic || 'AND'} 逻辑联合判断，regex=true 时按正则匹配`;
        replacements.multi_mode_result_description = replacements.multi_mode === 'groups'
            ? '命中组时返回该组 result，全部未命中时返回默认值'
            : `简单模式命中后返回 ${resolvedData.result || context?.rule?.result || '命中结果'}，未命中时返回默认值`;

        if (definition.saveTarget === 'config.expansion_rules') {
            const expansionRules = resolvedData.expansion_rules && typeof resolvedData.expansion_rules === 'object'
                ? resolvedData.expansion_rules
                : {};
            replacements.expansion_rule_count = String(Object.keys(expansionRules).length);
        }

        return replacements;
    }

    function applyTemplate(template, replacements) {
        return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (matchedText, key) => {
            return Object.prototype.hasOwnProperty.call(replacements, key) ? replacements[key] : matchedText;
        });
    }

    function buildSummaryText(definition, data, context) {
        const template = String(definition.summaryTemplate || '').trim();
        if (!template) {
            return context?.rule?.remarks || '';
        }
        return applyTemplate(template, buildTemplateReplacements(definition, data, context));
    }

    function getRuntimeData() {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            return {};
        }

        const baseData = getJsonEditorBaseValue(context) || getWorkingConfigForContext(context);
        const { values } = collectFormValuesFromDom(context.definition);
        return Object.assign({}, baseData, values);
    }

    function refreshRuntimePanels() {}

    function refreshModuleForm() {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            return;
        }
        const formElement = document.getElementById('dynamicConfigQueryForm');
        if (!formElement) {
            return;
        }
        const workingConfig = getRuntimeData();
        formElement.innerHTML = renderModuleFieldsHtml(context, workingConfig);
        refreshTransientFieldValues();
        refreshPreviewIfVisible();
    }

    function refreshTransientFieldValues() {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            return;
        }
        const workingConfig = getJsonEditorBaseValue(context) || getWorkingConfigForContext(context);
        (context.definition.fields || []).forEach(field => {
            if (field.transient !== true || !field.key) {
                return;
            }
            const element = document.getElementById(getFieldDomId(field));
            if (!element) {
                return;
            }
            const value = getFieldCurrentValue(field, workingConfig, context.config, context.rule);
            element.value = value === undefined || value === null ? '' : String(value);
        });
    }

    function buildCodePreview(context) {
        const definition = context.definition || {};
        let workingData;
        try {
            workingData = getRuntimeData();
        } catch (error) {
            return `// JSON 解析失败\n// ${error.message}`;
        }

        const summaryText = buildSummaryText(definition, workingData, context);
        return [
            `// 动态配置查询`,
            `source_type = ${JSON.stringify(context.sourceType)}`,
            `rule_index = ${JSON.stringify(context.ruleIndex)}`,
            `summary = ${JSON.stringify(summaryText)}`,
            '',
            JSON.stringify(workingData, null, 2)
        ].join('\n');
    }

    function sanitizeJsonPayloadForRule(jsonPayload) {
        if (!jsonPayload || typeof jsonPayload !== 'object' || Array.isArray(jsonPayload)) {
            return {};
        }
        return Object.keys(jsonPayload).reduce((accumulator, key) => {
            if (!PROTECTED_RULE_KEYS.has(key)) {
                accumulator[key] = jsonPayload[key];
            }
            return accumulator;
        }, {});
    }

    async function saveCurrentContext() {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            safeShowToast('当前没有可保存的动态配置', true);
            return;
        }

        const { definition } = context;
        const { values: formValues, missingLabels } = collectFormValuesFromDom(definition);

        let jsonPayload = null;
        let runtimePayload = getRuntimeData();
        if (DYNAMIC_QUERY_STATE.jsonDirty) {
            try {
                jsonPayload = parseJsonEditor();
                runtimePayload = Object.assign({}, runtimePayload, jsonPayload);
                setJsonStatus('JSON 校验通过，保存时将按 JSON 写入', '#15803d');
            } catch (error) {
                safeShowToast(`JSON 解析失败：${error.message}`, true);
                setJsonStatus(`JSON 解析失败：${error.message}`, '#dc2626');
                return;
            }
        }

        const requiredMissingLabels = (definition.fields || []).reduce((accumulator, field) => {
            if (!field.key || !field.required || field.type === 'info' || field.transient === true) {
                return accumulator;
            }
            const value = runtimePayload[field.key];
            if (value === '' || value === null || value === undefined) {
                accumulator.push(field.label || field.key);
            }
            return accumulator;
        }, []);

        if (requiredMissingLabels.length > 0 || (!DYNAMIC_QUERY_STATE.jsonDirty && missingLabels.length > 0)) {
            safeShowToast(`请填写${(requiredMissingLabels.length > 0 ? requiredMissingLabels : missingLabels).join('、')}`, true);
            return;
        }

        try {
            // 保存到内存
            if (definition.saveTarget === 'config.expansion_rules') {
                const nextExpansionRules = jsonPayload && typeof jsonPayload === 'object'
                    ? (
                        jsonPayload.expansion_rules && typeof jsonPayload.expansion_rules === 'object'
                            ? jsonPayload.expansion_rules
                            : jsonPayload
                    )
                    : (context.config.expansion_rules || {});
                context.config.expansion_rules = deepClone(nextExpansionRules);
            } else {
                const nextRule = Object.assign({}, context.rule);
                if (definition.initialValues && typeof definition.initialValues === 'object') {
                    Object.keys(definition.initialValues).forEach(key => {
                        if (!Object.prototype.hasOwnProperty.call(nextRule, key)) {
                            nextRule[key] = deepClone(definition.initialValues[key]);
                        }
                    });
                }
                Object.assign(nextRule, sanitizeJsonPayloadForRule(runtimePayload));
                if (jsonPayload) {
                    Object.assign(nextRule, sanitizeJsonPayloadForRule(jsonPayload));
                }
                if (context.sourceType === 'conditional_multi') {
                    const mode = detectMultiConditionalModeSafe(runtimePayload, context.rule);
                    if (mode === 'groups') {
                        delete nextRule.conditions;
                        delete nextRule.logic;
                        delete nextRule.result;
                        nextRule.groups = Array.isArray(runtimePayload.groups) ? runtimePayload.groups : [];
                        nextRule.group_logic = runtimePayload.group_logic || 'OR';
                    } else {
                        delete nextRule.groups;
                        delete nextRule.group_logic;
                        nextRule.conditions = Array.isArray(runtimePayload.conditions) ? runtimePayload.conditions : [];
                        nextRule.logic = runtimePayload.logic || 'AND';
                        nextRule.result = runtimePayload.result || '';
                    }
                }
                nextRule.source_type = context.sourceType;
                context.config.mapping_rules[context.ruleIndex] = nextRule;
            }

            if (typeof renderMappingConfig === 'function') {
                renderMappingConfig(context.config);
            }
            try {
                mappingTableDirty = true;
            } catch (error) {}

            DYNAMIC_QUERY_STATE.jsonDirty = false;
            DYNAMIC_QUERY_STATE.currentContext = null;

            // 🔥 关键修复：同时保存到后端API
            let backendSaveSuccess = false;
            try {
                console.log('[DynamicConfigQuery] 正在同步保存到后端...');
                await saveDefinitionsToBackend();
                backendSaveSuccess = true;
                console.log('[DynamicConfigQuery] 后端保存成功');
            } catch (backendError) {
                console.warn('[DynamicConfigQuery] 后端保存失败，但本地配置已保存:', backendError.message);
                backendSaveSuccess = false;
            }

            // 根据后端保存结果显示不同的提示
            if (backendSaveSuccess) {
                safeShowToast(`${definition.title || '动态配置'}已保存并同步到服务器`, false);
            } else {
                safeShowToast(`${definition.title || '动态配置'}已保存（注意：后端同步失败）`, false);
            }

            if (typeof closeAdvancedConfigModal === 'function') {
                closeAdvancedConfigModal();
            }
        } catch (error) {
            console.error('[DynamicConfigQuery] 保存动态配置失败:', error);
            safeShowToast(`保存失败：${error.message}`, true);
        }
    }

    function resolveRuleContextFromEvent(event, sourceType) {
        const clickedButton = event && event.target ? event.target : null;
        if (!clickedButton) {
            safeShowToast('未找到动态配置触发按钮', true);
            return null;
        }

        const row = clickedButton.closest('tr[data-rule-index]');
        if (!row) {
            safeShowToast('未找到动态配置所在行', true);
            return null;
        }

        const ruleIndex = Number.parseInt(row.dataset.ruleIndex, 10);
        const config = getCurrentMappingConfigSafely();
        if (!config || !Array.isArray(config.mapping_rules)) {
            safeShowToast('当前映射配置未加载完成', true);
            return null;
        }

        const rule = config.mapping_rules[ruleIndex];
        if (!rule) {
            safeShowToast('未找到当前映射规则', true);
            return null;
        }

        const definition = getDefinition(sourceType);
        if (!definition) {
            safeShowToast(`未登记 ${sourceType} 的动态配置定义`, true);
            return null;
        }

        return {
            row,
            ruleIndex,
            rule,
            config,
            sourceType: normalizeSourceType(sourceType),
            definition
        };
    }

    async function ensureContextDependencies(context) {
        const fields = Array.isArray(context.definition.fields) ? context.definition.fields : [];
        const requiredDataSources = fields
            .filter(field => field.type === 'field_select' && field.dataSource)
            .map(field => resolveDataSourceToken(field.dataSource, context.rule, context.config))
            .filter(Boolean);

        if (requiredDataSources.length > 0) {
            try {
                if (typeof ensureMappingColumnsLoaded === 'function') {
                    await ensureMappingColumnsLoaded(requiredDataSources);
                }
            } catch (error) {
                console.warn('[DynamicConfigQuery] 加载字段依赖失败:', error);
            }
        }

        if (fields.some(field => field.type === 'public_config_select')) {
            try {
                if (typeof ensurePublicConfigCenterDataLoaded === 'function') {
                    await ensurePublicConfigCenterDataLoaded();
                }
            } catch (error) {
                console.warn('[DynamicConfigQuery] 加载公共配置依赖失败:', error);
            }
        }
    }

    async function openDynamicConfigQueryModal(event, sourceType) {
        const context = resolveRuleContextFromEvent(event, sourceType);
        if (!context) {
            return;
        }

        context.ruleSourceName = resolveDataSourceToken('rule_source', context.rule, context.config) === 'assets'
            ? '数据概览表'
            : '合并结果表';

        await ensureContextDependencies(context);

        if (typeof openAdvancedConfigModal !== 'function') {
            safeShowToast('当前页面尚未准备好高级配置弹窗', true);
            return;
        }

        DYNAMIC_QUERY_STATE.currentContext = context;
        DYNAMIC_QUERY_STATE.jsonDirty = false;
        DYNAMIC_QUERY_STATE.transientValues = {};

        openAdvancedConfigModal({
            title: context.definition.title || '动态配置查询',
            subtitle: context.definition.subtitle || '',
            toneColor: context.definition.toneColor || '#0f4fa8',
            moduleHtml: buildModuleHtml(context),
            jsonHtml: buildJsonEditorHtml(context),
            codePreviewBuilder: function() {
                return buildCodePreview(context);
            },
            saveHandler: saveCurrentContext,
            sourceType: context.sourceType,
            ruleIndex: context.ruleIndex,
            initialTab: 'module',
            maxWidth: '980px',
            compactMode: true
        });

        setTimeout(() => {
            syncJsonFromForm();
        }, 0);
    }

    function applySingleConditionalTemplateAction() {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            return;
        }

        const field = (context.definition.fields || []).find(item => item.key === 'preset_template');
        if (!field) {
            syncJsonFromForm();
            return;
        }

        const element = document.getElementById(getFieldDomId(field));
        if (!element) {
            syncJsonFromForm();
            return;
        }

        const presetId = String(element.value || '').trim();
        if (!presetId) {
            syncJsonFromForm();
            return;
        }

        const presets = getSingleConditionalTemplatePresetsSafe();
        const preset = presets[presetId];
        if (!preset) {
            syncJsonFromForm();
            return;
        }

        const nextConfig = Object.assign({}, getRuntimeData(), {
            conditions: deepClone(preset.conditions || []),
            default: preset.default || ''
        });

        const defaultField = document.getElementById('dynamicConfigQueryField_default');
        if (defaultField) {
            defaultField.value = nextConfig.default;
        }

        const jsonElement = getJsonEditorElement();
        if (jsonElement) {
            jsonElement.value = JSON.stringify(nextConfig, null, 2);
        }

        DYNAMIC_QUERY_STATE.jsonDirty = false;
        setJsonStatus('条件模板已应用，并同步到 JSON', '#15803d');
        refreshPreviewIfVisible();
    }

    function applyMultiConditionalModeAction() {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            return;
        }

        const field = (context.definition.fields || []).find(item => item.key === 'mode');
        if (!field) {
            syncJsonFromForm();
            return;
        }

        const element = document.getElementById(getFieldDomId(field));
        if (!element) {
            syncJsonFromForm();
            return;
        }

        const mode = String(element.value || 'simple').trim() === 'groups' ? 'groups' : 'simple';
        DYNAMIC_QUERY_STATE.transientValues.mode = mode;

        const currentData = getRuntimeData();
        const nextConfig = Object.assign({}, currentData, {
            __dynamic_mode: mode,
            default: currentData.default || '',
            remarks: currentData.remarks || ''
        });

        if (mode === 'groups') {
            nextConfig.group_logic = currentData.group_logic || 'OR';
            nextConfig.groups = Array.isArray(currentData.groups) ? currentData.groups : [];
        } else {
            nextConfig.logic = currentData.logic || 'AND';
            nextConfig.conditions = Array.isArray(currentData.conditions) ? currentData.conditions : [];
            nextConfig.result = currentData.result || '';
        }

        const jsonElement = getJsonEditorElement();
        if (jsonElement) {
            jsonElement.value = JSON.stringify(nextConfig, null, 2);
        }

        DYNAMIC_QUERY_STATE.jsonDirty = false;
        setJsonStatus('判断模式已切换，并同步到 JSON', '#15803d');
        refreshModuleForm();
    }

    function handleFieldChange(fieldKey) {
        const context = DYNAMIC_QUERY_STATE.currentContext;
        if (!context) {
            return;
        }

        const targetField = (context.definition.fields || []).find(field => field.key === fieldKey);
        if (targetField && targetField.transient === true) {
            const element = document.getElementById(getFieldDomId(targetField));
            if (element) {
                DYNAMIC_QUERY_STATE.transientValues[targetField.key] = targetField.type === 'checkbox'
                    ? element.checked
                    : element.value;
            }
        }
        if (targetField && targetField.action === 'apply_single_conditional_template') {
            applySingleConditionalTemplateAction();
            return;
        }
        if (targetField && targetField.action === 'apply_multi_conditional_mode') {
            applyMultiConditionalModeAction();
            return;
        }

        syncJsonFromForm();
    }

    function bootstrapDefaultDefinitions() {
        Object.keys(DEFAULT_DYNAMIC_CONFIG_QUERY_DEFINITIONS).forEach(sourceType => {
            registerDefinition(sourceType, DEFAULT_DYNAMIC_CONFIG_QUERY_DEFINITIONS[sourceType]);
        });
    }

    // ==================== 后端保存功能 ====================

    /**
     * 保存配置查询定义到后端
     * @returns {Promise<Object>} 保存结果
     */
    async function saveDefinitionsToBackend() {
        try {
            const payload = exportDefinitions();

            console.log('[DynamicConfigQuery] 正在保存配置查询定义...', payload);

            const response = await fetch(DYNAMIC_QUERY_STATE.apiBase + '/dynamic-config-query/definitions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: 保存失败`);
            }

            const result = await response.json();
            console.log('[DynamicConfigQuery] 保存成功:', result);

            // 显示成功提示
            if (typeof showToast === 'function') {
                showToast('配置查询定义已保存', false);
            } else {
                alert('配置查询定义已保存');
            }

            // 标记为已保存（清除dirty标志）
            DYNAMIC_QUERY_STATE.jsonDirty = false;

            return result;
        } catch (error) {
            console.error('[DynamicConfigQuery] 保存配置查询定义失败:', error);

            // 显示错误提示
            if (typeof showToast === 'function') {
                showToast('保存失败: ' + error.message, true);
            } else {
                alert('保存失败: ' + error.message);
            }

            throw error;
        }
    }

    /**
     * 从后端加载配置查询定义
     * @returns {Promise<Object>} 加载的定义
     */
    async function loadDefinitionsFromBackend() {
        try {
            console.log('[DynamicConfigQuery] 正在加载配置查询定义...');

            const response = await fetch(DYNAMIC_QUERY_STATE.apiBase + '/dynamic-config-query/definitions');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: 加载失败`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || '加载失败');
            }

            console.log('[DynamicConfigQuery] 加载成功:', result.data);

            // 导入定义到内存
            if (result.data && result.data.definitions) {
                importDefinitions(result.data.definitions);
            }

            return result.data;
        } catch (error) {
            console.error('[DynamicConfigQuery] 加载配置查询定义失败:', error);
            throw error;
        }
    }

    /**
     * 检查是否有未保存的修改
     * @returns {boolean} 是否有未保存的修改
     */
    function hasUnsavedChanges() {
        return DYNAMIC_QUERY_STATE.jsonDirty;
    }

    // ==================== 导出API ====================

    bootstrapDefaultDefinitions();

    global.DynamicConfigQueryManager = {
        registerDefinition,
        getDefinition,
        listDefinitions,
        exportDefinitions,
        toJSON,
        importDefinitions,
        replaceDefinitions,
        hasDefinitions,
        setDefinitionEnabled,
        open: openDynamicConfigQueryModal,
        handleFieldChange,
        markJsonDirty,
        applyJsonToForm,
        syncJsonFromForm,
        saveCurrentContext,
        // 新增：后端保存功能
        saveToBackend: saveDefinitionsToBackend,
        loadFromBackend: loadDefinitionsFromBackend,
        hasUnsavedChanges: hasUnsavedChanges
    };

    global.openDynamicConfigQueryModal = openDynamicConfigQueryModal;
})(window);
