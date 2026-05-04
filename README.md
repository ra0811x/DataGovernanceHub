# DataGovernanceHub

一个面向企业数据资产治理的 Flask 系统，支持规则配置、处理流程与标准化 Excel 报表导出。

## 目录结构

- `core/`: Flask 应用入口与核心逻辑
- `routes/`: 各业务模块 API 路由
- `config/`: 系统配置与映射规则
- `web/` `js/` `css/`: 前端资源
- `Templates/`: 导出模板文件

## 环境要求

- Python 3.11+
- Windows

## 快速开始

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python core/app.py
```

默认地址：`http://127.0.0.1:8100`

## 关键环境变量

- `APP_HOST`（默认 `127.0.0.1`）
- `APP_PORT`（默认 `8100`）
- `APP_DEBUG`（默认 `false`）
- `SECRET_KEY`（生产环境必须配置）
- `ENABLE_CORS` / `CORS_ORIGINS`
