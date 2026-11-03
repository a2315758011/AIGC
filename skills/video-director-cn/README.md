# video-director-cn｜程序化代码视频导演

把 `win4r/video-director` 的代码视频制作工作流引入 AIGC 分镜仓库，并增加与本仓库 SCG/事件时间契约的单向适配。

## 能做什么

- 将一句话视频简报整理成制作方案、结构选择和数字化时间表；
- 用 HTML、Canvas、SVG、Three.js、GSAP 或 Remotion 编写可控动画；
- 逐帧渲染 MP4，保留可编辑源码；
- 自动检查时间轴、首帧、闪帧、冻结、剪辑点、文字可读性、响度、静音和循环接缝；
- 输出关键帧联系表、手机尺寸检查图和机器 QA 报告。

## 与现有分镜体系的关系

本技能是分镜后的渲染/执行层，不替代正式分镜导演、SCG、事件时间账本、人物站位、场景真实性、运镜和真人影视技能。

AIGC 的 SCG 和事件时间账本仍是剧情世界状态与事件时序的唯一事实源。新增 `compile_aigc_timeline.py` 只把已人工复核的事件账本转换为 video-director 所需的秒级渲染时间表，不复制实体、关系或世界状态。

## 快速调用

> 调用程序化视频导演：根据已批准分镜制作 15 秒动态 UI/解释动画，保留 shot_id/event_id，使用确定性逐帧渲染，完成时间轴检查、MP4 QA 和独立审片。

## 依赖

- Python 3.9+
- QA：ffmpeg、ffprobe、NumPy、Pillow（见 `requirements-qa.txt`）
- HTML/Canvas：当前项目自己的 Node.js、Playwright/Chromium
- Remotion：按目标项目现有 package.json 和锁文件安装/运行

不要为单次调用全局安装依赖；不要覆盖已有工程或 QA 证据目录。

## 本目录结构

- `SKILL.md`：中文入口与 AIGC 适配规则
- `scripts/compile_aigc_timeline.py`：SCG 事件时间账本到渲染时间表的单向投影
- `scripts/check_timeline.py`、`qa_video.py`：上游原始校验器
- `references/`：上游规则原文、五份制作/来源参考与中文速查
- `tests/`：适配器、时间轴与清单回归
- `SOURCE_LOCK.json`：上游固定提交、文件 SHA 和跨技能依赖
- `artifact-manifest.json`：本技能包文件集合、大小与 SHA-256

## 有意未复制的内容

上游 demo 视频/动图属于展示素材，不是运行依赖；上游 evals 作为上游评测材料保留在原仓库，不混入 AIGC 运行包。本仓库提供更贴合 SCG/事件时间契约的适配器测试和 MP4 QA smoke test。上游评测结果不得当成本仓库的 E4 生产证据。

## 验证边界

GitHub Actions 静态测试通过只证明适配器、时间轴校验器、QA 工具 smoke test 和包清单覆盖范围内的检查通过。真实真人视频、目标视频模型服从率、角色表演质量、正式生产工程导入和用户发布流程仍需实际验收。
