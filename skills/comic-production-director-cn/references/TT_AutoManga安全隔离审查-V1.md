# TT_AutoManga 源码安全与本地兼容性审查

审查日期：2026-11-02  
目标：判断 TT_AutoManga 是否适合直接接入 MOONKEEP 商业漫画生产。  
审查范围：GitHub 源码/测试静态审查、用户工作站只读依赖与本地服务探测。未安装依赖、未启动外部服务、未修改用户项目。

## 一、结论

**TT_AutoManga 的漫画流程设计有采纳价值，但当前不能直接接入 MOONKEEP，也不能把它的 FastAPI 后端开放到公网/Tailscale。**

主要原因：
1. 后端 API 默认无用户身份认证，主程序绑定 127.0.0.1；只适合本机隔离使用。不得改成 0.0.0.0，不得通过现有 Tailscale MCP 网关转发其 5180 端口。
2. 后端启动时会运行 `_cleanup_orphan_assets()`，自动删除资产索引中未被现有项目引用的图片。即使它会在项目文件缺失/解析失败时中止清理，也无法保证“暂存但尚未绑定项目的候选图”不会被当作孤儿删除。
3. 项目数据默认写到代码仓库根目录 `data/projects`、`data/assets` 和 `data/settings.json`；必须使用独立副本和独立数据根，不能指向 MOONKEEP 原始资料或共享素材目录。
4. MCP Server 是 stdio 包装器，直接调用本机 HTTP API；不自带内容审核、项目级权限或外部身份认证。不能因为它提供 MCP 工具就视为具备多租户安全。
5. 默认图像后端为 SwarmUI `http://127.0.0.1:7801`，并非 GPT 原生生图直连。当前工作站该端口探测未响应；ComfyUI 默认端口 8188 同样未响应。

## 二、源码审查证据

审查的文件与 Git Blob SHA：
- `backend/main.py`：`8cbbef5b0d2f51c11439c3546c05ff944c74d920`
- `backend/mcp_server.py`：`18f6a12798cb838b35c696639fca0b557937e47c`
- `backend/mcp_tools.py`：`d10a4eed708205a7acfdc86c234125adf0a33469`
- `backend/api/agent.py`：已读取；通过受管理的 asset URL/data URL 接受图像输入，拒绝任意文件系统路径作为 img2img 源。
- `backend/storage/manager.py`：读取 `_SAFE_ID_RE`，项目 ID 限制为字母/数字/下划线/短横线，长度 1–128。
- `backend/storage/asset_store.py`：资产以 UUID 文件保存，索引记录 project_id/kind/meta；`remove()` 会删除索引中对应文件。
- `backend/core/config.py`：数据目录位于仓库根目录下；默认语言为英文；默认 LLM 配置指向 OpenAI 兼容接口，默认 SwarmUI 地址为 127.0.0.1:7801。
- `backend/core/swarmui_client.py`：SwarmUI HTTP 客户端；支持 img2img/inpaint 数据 URL、seed、LoRA、模型和尺寸；未提供 GPT 原生图像 API 直连。
- `backend/tests/test_security_regression.py`：测试源码覆盖 CORS、API key 脱敏、项目 ID 路径穿越、静态文件穿越、归档任意文件读取、导出路径穿越等。
- `backend/tests/test_save_guard.py`：测试源码覆盖空 panels 自动保存不得清空 Agent 已写入的分镜、设置键合并等数据保护。
- `backend/tests/test_asset_store.py`、`test_mcp_tools.py`、`test_e2e_agent.py` 等也存在。

## 三、重要风险：启动时孤儿资产清理

`backend/main.py` 的 FastAPI lifespan 在每次后端启动时调用 `_cleanup_orphan_assets()`。

清理逻辑：
- 遍历 `data/projects` 下每个项目目录；
- 任一目录缺少 `project.json` 或 JSON 解析失败时，整次清理中止；
- 否则收集项目 panels 和 composerPages 中引用的资产；
- 删除资产索引中未被收集到的资产；
- 还会清理旧式项目资产目录中未引用的文件。

风险场景：
- 画格候选、封面候选、未绑定的参考图、临时导入图可能已保存到 assets，但尚未被 panel/page 引用；
- 后端重启时，这些文件可能被判定为 orphan 并删除；
- 空项目库但资产目录已有文件时，也可能发生批量删除。

因此：
- 不得把 MOONKEEP 原始图、遮罩、候选图、参考图或批准图放入 TT_AutoManga 的默认 data/assets；
- 不得在 MOONKEEP 原始项目目录中运行其后端；
- 如未来试用，必须复制到独立隔离目录，且启动前对 data/assets 做只读清单与哈希快照；
- 试用期间禁用自动清理或修改其清理策略之前，不能用于正式项目；
- 任何候选资产必须先进入 project manifest 或被引用，再重启服务；否则先备份。

## 四、网络与 MCP 边界

- `backend/main.py` 当前绑定 `127.0.0.1`，这是正确的默认边界。
- `backend/mcp_server.py` 使用 stdio transport；MCP 工具通过本机 HTTP API 调用。
- `backend/mcp_tools.py` 默认请求 `http://127.0.0.1:5180`。
- 后端 API 未见身份认证中间件；其安全假设是本机 loopback，不是公网服务。

强制限制：
1. 保持 API 只监听 loopback。
2. 禁止把 5180 端口暴露到 Tailscale Funnel、公网反向代理或共享 MCP 网关。
3. 需要远程 AI 使用时，只能评估经认证、逐项目授权、可撤销的 stdio/本机代理；不能把无认证 HTTP API 直接转发。
4. 对外部模型/API Key 采用独立测试密钥，日志不得写明文凭据。
5. 项目 ID 校验和路径穿越测试是正向证据，但不能代替鉴权和多租户隔离。

## 五、用户工作站只读兼容性探测

本轮通过 Windows MCP 做了只读探测：
- Python 3.11：存在；fastapi、pydantic、httpx、Pillow、torch 可导入。
- Python 3.11：pytest 与 mcp SDK 未安装。
- Python 3.13：OpenCV 与 Pillow 可导入；torch、pytesseract、lama_cleaner、pcleaner、pytest 未安装。
- Node：v24.13.0。
- SwarmUI 默认地址 127.0.0.1:7801：探测无响应。
- ComfyUI 常见地址 127.0.0.1:8188：探测无响应。
- 未执行任何 pip install、模型下载或服务启动。

这意味着：
- TT_AutoManga 不能直接启动完整 MCP 服务：当前 Python 3.11 缺少 mcp SDK。
- 后端测试不能直接运行：当前 Python 3.11 缺少 pytest。
- 真实出图不能运行：SwarmUI 未响应。
- manga-text-removal 的 CTD-LaMa 不能运行：缺少 pcleaner、lama_cleaner、pytesseract 和模型权重。
- 本轮只完成源码审查和本地依赖/端口探测；不标记为工具安装或运行通过。

## 六、采纳决策

| 能力 | 决策 | 原因 |
|---|---|---|
| beat sheet / 页面叙事节拍 / Reader Test | 采纳方法 | 有明确的工艺步骤，不依赖其后端 |
| 角色圣经/故事 Bible / 逐格状态 | 参考并映射现有 SCG | 不新建重复的角色/场景事实系统 |
| 页面预览与逐格 QC | 采纳方法 | 对读者理解、气泡、解剖和一致性有明确检查项 |
| 单格返工 | 采纳方法 | 保留已批准页面和排字，避免整页重生成 |
| TT_AutoManga MCP 服务 | 暂不部署 | 缺少 mcp SDK/pytest/SwarmUI；后端无认证 |
| TT_AutoManga 资产存储 | 暂不接入 | 启动清理可能删除未绑定候选资产 |
| TT_AutoManga 页面排版/自动气泡 | 只作候选 | 自动尾巴与气泡位置必须人工验收；不能默认通过 |
| GPT 原生生图直连 | 不支持 | 当前默认接口是 SwarmUI，不能谎称直连 GPT 原生生图 |

## 七、下次试验门槛

只有满足以下条件才允许做隔离试验：
1. 创建全新独立目录，使用临时数据根；不复用 MOONKEEP 数据目录。
2. 明确关闭或替换启动自动清理逻辑，或证明清理只作用于明确的临时数据目录。
3. 本机 Python 3.11 环境具备必要依赖；先执行作者测试，不下载模型。
4. 5180 API 只监听 127.0.0.1；MCP 使用 stdio；禁止公网暴露。
5. 先做 CRUD/页面布局/导出空白测试，再做非敏感测试图。
6. 测试完成后验证源项目目录、哈希和资产数量无变化。

## 八、结论

TT_AutoManga 当前评级：
- 漫画叙事/页面工作流方法：高；
- 源码安全与数据保护：中（有较好的路径/密钥/保存回归，但存在启动孤儿清理风险及无认证本地 API）；
- 目标工作站可运行性：BLOCKED；
- MOONKEEP 正式接入：暂不采纳；
- 外部代码复制到 AIGC 仓库：不需要，也不建议。MIT 许可证不代表必须复制，优先只采纳方法或隔离独立运行。

外部来源：
- https://github.com/TTDiang2/TT_AutoManga
