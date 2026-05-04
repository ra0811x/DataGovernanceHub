# DataGovernanceHub

一个面向企业数据资产治理与上报的 Flask 一体化系统，覆盖资产数据管理、合并结果处理、规则驱动填报导出、文件管理、数据处理与系统日志审计。

## 项目定位

系统用于支撑“数据治理到报表上报”的完整链路，核心目标是：

- 统一资产与合并结果数据口径；
- 通过映射配置、条件规则、公共配置驱动报表生成；
- 提供可追踪的导入、处理、导出和日志能力；
- 在单仓库内完成前后端协同运行（Flask + 静态前端）。

## 核心功能模块

- 数据概览（`assets`）：资产主数据检索、维护、导入、列表配置与单条编辑。
- 合并结果（`merge_results`）：高容量数据浏览、统计、清洗、筛减与导出前复核。
- 填报数据：按模板与映射配置生成业支/SMC/信安等报表。
- 文件管理：模板、数据库相关文件与导出结果分类管理。
- 数据处理：一键处理、拆分、CSV 转换、去重、进度与结果下载。
- 系统日志：操作记录查询、统计、筛选与分页审计。

## 技术架构

- 后端：Flask（启动入口 `core/app.py`）
- 前端：`web/` + `js/` + `css/` 静态资源
- 数据库：SQLite（运行时本地库）
- 导出引擎：`core/export_engine.py`
- 配置驱动：`config/*.json`（映射、规则、公共配置、导出策略等）

系统属于前后端一体化部署模式，默认本地访问地址：`http://127.0.0.1:8100`。

## 关键目录说明

- `core/`：后端核心逻辑（应用启动、导出引擎、导入处理、工具函数）
- `routes/`：Flask 蓝图路由层（资产、合并、导出、日志、配置、数据处理）
- `config/`：系统配置与映射规则（JSON + `config.py`）
- `Templates/`：报表模板与模板元数据
- `web/` `js/` `css/`：前端页面与脚本样式

以下目录为运行产物或敏感数据目录，仓库仅保留空目录占位：

- `data/`
- `DataFiles/`
- `SGExportFiles/`
- `uploaded_files/`
- `temp_data_process/logs/`

## 快速开始

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python core/app.py
```

浏览器打开：

`http://127.0.0.1:8100`

## 环境变量

- `APP_HOST`：监听地址（默认 `127.0.0.1`）
- `APP_PORT`：端口（默认 `8100`）
- `APP_DEBUG`：调试开关（默认 `false`）
- `SECRET_KEY`：Flask 密钥（生产环境必须配置）
- `ENABLE_CORS` / `CORS_ORIGINS`：跨域控制
- `EXPORT_FOLDER`：导出目录覆盖（可选）

PowerShell 示例：

```powershell
$env:SECRET_KEY="replace-with-a-strong-secret"
$env:APP_HOST="127.0.0.1"
$env:APP_PORT="8100"
$env:APP_DEBUG="0"
python core/app.py
```

## 运行与协作说明

- 本仓库已通过 `.gitignore` 忽略运行数据库、日志、导出结果与上传文件。
- 其他开发者克隆后可直接启动系统；业务数据需按本地导入流程自行导入。
- 模板文件变更会直接影响导出口径，修改前建议先在测试数据上回归验证。

## 当前版本边界

- 系统以配置驱动为主，导出行为受 `config/` 与 `core/export_engine.py` 共同影响。
- 路由层中 `routes_common.py`、`routes_data_process.py` 与导出引擎相对复杂，属于主要回归风险点。
- 若新增报表或规则，建议同步补充映射配置、公共配置与回归样例。
