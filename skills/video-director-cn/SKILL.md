---
name: video-director-cn
description: 将已批准分镜或一句话视频简报转为可控的代码动画与 MP4；适用于 HTML、Canvas、SVG、Three.js、GSAP、Remotion、动态 UI、HUD、数据故事、程序化特效、解释动画、片头片尾和循环短片。只在目标是代码渲染视频时调用，不替代正式分镜、真人视频生成或图生视频提示词。
compatibility: Python 3.9+；QA 需要 ffmpeg/ffprobe、NumPy、Pillow；HTML 渲染需要项目自己的 Node.js、Playwright/Chromium 或 Remotion 环境。
metadata:
  version: "1.0.0"
  language: "zh-CN"
  upstream: "win4r/video-director@4747e5c153509ef7f8f7fd1a0aad6acfda36280d"
  source_license: "MIT"
---

# 程序化视频导演与确定性渲染 Skill

## 1. 触发条件

当用户要求把视频简报、已批准分镜、动态图形或系统 UI 制作成可重复渲染的动画/MP4，或要求审查、修复已有代码动画时调用。

适用：动态 UI/HUD、图表、解释动画、产品短片、片头片尾、转场、循环动画、可控粒子/能量图形、数据故事、程序化 2D/3D 画面。

不要单独用于：
- 只要求编写正式分镜脚本：先调用 `storyboard-director-cn`。
- 只要求摄影机运动设计：调用 `camera-motion-director-cn`。
- 目标是真人仿实拍演员表演：本技能只做 UI/字幕/后期叠加或预演，不能冒充真人视频。
- 目标是图生视频/文生视频模型提示词：走目标模型适配流程。
- 只要静态分镜图/多宫格联系表：调用现有分镜/联系表技能。

## 2. 激活后必须读取

1. `../../docs/代码动画与程序化视频制作规范-V1.md`（本仓库权威指令源）。
2. `references/程序化视频工作流中文速查-V1.md`。
3. `references/upstream-SKILL.md`（上游完整原文）。
4. 按任务读取 `references/briefs.md`、`craft.md`、`sound.md`、`quality.md`；涉及上游方法来源、引用或采纳依据时读取 `references/sources.md`。
5. 涉及剧情/人物/道具/场景/镜头事实时，读取当前主线：
   - `../storyboard-director-cn/SKILL.md`
   - `../storyboard-director-cn/references/分镜SCG数据契约-V1.md`
   - `../storyboard-director-cn/references/分镜事件时间数据契约-V1.md`
   - `../director-previs-cn/references/导演共享事实与SCG交接规范-V1.md`
6. 核对 `SOURCE_LOCK.json`，不得用过期快照冒充当前主线。

## 3. 权威事实边界

- 原剧本和用户锁定事实优先。
- SCG 是每镜 entities / relations / events 的唯一世界状态事实源。
- 事件时间账本是镜头/事件时间和可见事件的权威来源。
- `timeline.json` 是从已复核数据派生的**渲染时间表**，不是第二套 SCG，也不能重写人物、道具、场景状态。
- `timeline.json` 的秒数由毫秒时间账本换算而来；不得擅自估算、补造事件或镜头 ID。
- 本技能负责渲染层的图形、动画、音画 cue、文字可读性和机器 QA。人物站位、静态场景、动作因果和摄影机轨迹仍由各自专业规则负责。

## 4. 执行工作流

1. **锁定输入**：读取简报、剧本、正式分镜、SCG、事件时间账本、批准资产和目标交付规格；未知项明确标记。
2. **写创意方案**：创建 `TREATMENT.md`，比较三种结构方向，说明最终选择；只学习参考作品的节奏/构图/镜头语法，不复制其内容。
3. **编译时间表**：AIGC 剧情项目先运行 `scripts/compile_aigc_timeline.py`，从已人工复核的事件时间账本派生 `timeline.json`。
4. **时间轴门禁**：运行 `scripts/check_timeline.py`；ERROR 必须修复后才能写动画代码，WARN 必须修复或写明保留理由。
5. **静帧先行**：先做 styleframe、首帧、高潮帧和结尾海报；构图/素材/文字不通过，不进入高成本渲染。
6. **确定性编码**：每帧是时间 t 或 frame index 的纯函数；禁止隐式计时器、Date.now、未固定随机数、跨帧隐藏状态。
7. **同步声音与文字**：音乐、旁白、字幕、SFX、画面 cue 共享同一时间表；真实词级时间戳优先，估算值标记 ESTIMATED。
8. **逐帧渲染**：按项目批准 FPS、分辨率和色彩规格渲染；不得擅自把 FPS 固定为 24/30/60。
9. **成片 QA**：运行 `scripts/qa_video.py`，检查 report、beat/phone/hook 联系表；无音轨时明确音频 QA 不适用。
10. **独立审片**：检查关键帧、快速动作连续帧、手机尺寸可读性、剧情事实和音画同步；构建者不得独自给自己的作品判定通过。
11. **局部修复**：一次只改一个主要缺陷，检查修改范围外帧是否保持像素一致，并重跑受影响测试。
12. **交付**：源码、MP4、timeline、poster、QA 报告、联系表、审片记录和来源锁一并归档。

## 5. 常用命令

从 AIGC 事件账本编译渲染时间表：

```bash
python skills/video-director-cn/scripts/compile_aigc_timeline.py --events events.json --episode EP01 --render-spec render-spec.json --out timeline.json
python skills/video-director-cn/scripts/check_timeline.py timeline.json
```

渲染后执行机器 QA：

```bash
python skills/video-director-cn/scripts/qa_video.py film.mp4 --out qa/run-001 --beats timeline.json
```

QA 依赖 ffmpeg、ffprobe、Python、NumPy 和 Pillow。HTML 渲染依赖由当前项目管理的 Node.js、Playwright/Chromium；不要为了单次任务全局安装或擅自改动共享环境。

## 6. 关键制作原则

- 先用数字计划时间，再写代码；所有时间以秒浮点数保存，最后一步才换算帧。
- 一部短片尽量只有一个主要视觉概念、一个焦点和一个核心揭示。
- 画面变化要被音乐、旁白、动作或阅读完成 cue 到；避免无意义循环。
- 动作可以快，信息必须留够阅读时间。
- 颜色有明确语义；避免默认渐变、无意义光晕、满屏粒子和重复镜头运动。
- 音效用于强调关键动作，不要为每个 UI 动作配音效。
- 测量最终 MP4，而不是只检查源码或原始 WAV。
- 联系表检查节奏和连续性；机器 QA 检查缺陷，不代替独立审美判断。

## 7. 交付状态必须分开

逐项报告：需求/事实锁定、时间表编译、时间轴静态检查、代码构建、MP4 真实渲染、机器 QA、人工关键帧检查、独立审片、最终交付验证。

未执行的步骤标记 NOT_RUN / 未验证。静态 PASS、文件上传或 CI 通过不能冒充真实生产成片通过。

## 8. 上游来源与适用限制

上游完整规则、制作模板、参数、声音和 QA 参考保存在本目录。原始上游版本为 `win4r/video-director@4747e5c153509ef7f8f7fd1a0aad6acfda36280d`，MIT 许可证。

上游重点面向 Claude Opus 5.5 / Claude Code；其他代码 Agent 可以遵循，但目标客户端和真实成片质量必须分别验证。上游评测为有限轮次的作者报告，不是本仓库生产质量保证。
