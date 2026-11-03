# video-director 开源项目审查与 AIGC 分镜仓库采纳报告

研究日期：2026-11-03  
目标仓库：`a2315758011/AIGC`  
集成分支：`feat/video-director-cn-20261103`  
上游项目：[`win4r/video-director`](https://github.com/win4r/video-director)  
固定上游提交：`4747e5c153509ef7f8f7fd1a0aad6acfda36280d`  
许可证：MIT（已保留原始 LICENSE）

## 1. 结论

**部分采纳：将 video-director 纳入 AIGC 仓库，作为正式分镜之后的代码动画/渲染与 MP4 QA 引擎。**

它的价值不是“让 AI 视频生成模型不再抽卡”，而是把一部分可程序化的画面从随机生成改为可复现的代码渲染。只要动画每帧是时间 t 的纯函数、素材/字体/渲染环境固定，同一输入就可以重复渲染并逐帧检查。

优先使用范围：

- 动态 UI、HUD、系统界面、字幕和数据图形；
- 可控粒子、能量线、屏幕投影、片头/片尾、转场；
- 解释动画、产品图形短片、数据故事；
- 需要精确时间、节奏、文字停留和循环接缝的程序化动画；
- 真人影视中的可控图形叠加、字幕、UI 和预演。

不采纳为真人演员表演、写实人物动作、复杂身体接触或目标视频模型提示词的替代方案。

## 2. 上游源码与许可证审查

固定提交：`4747e5c153509ef7f8f7fd1a0aad6acfda36280d`。

MIT 许可证允许复制、修改和再发布，但必须保留版权与许可声明。上游原始 LICENSE 已随技能包保留。

| 上游文件 | Git Blob SHA | 用途 |
|---|---|---|
| `video-director/SKILL.md` | `4023f229ac48ca99c7e3f5e9ffadb83450c084f2` | 原始导演工作流 |
| `video-director/scripts/check_timeline.py` | `c4c931c12fd7b275d33e107319a062c7cc4ceb59` | 渲染前时间轴检查 |
| `video-director/scripts/qa_video.py` | `c62dfeb72c15b723a9d4a1d9f294a0f181358a28` | MP4 渲染后质量检查 |
| `video-director/references/briefs.md` | `22f70ba6946cc60d895cb75ff3cd25a007e40971` | 简报、结构和时间表模板 |
| `video-director/references/craft.md` | `ab7813dcbe8f03a71c2234f029ceab646538a026` | 画面工艺与可读性 |
| `video-director/references/sound.md` | `15a788134966566bc9f4456bef6d179f429c451b` | 音乐、旁白与 SFX |
| `video-director/references/quality.md` | `dc370b7758a1b937e192a029b4783f1d9361581b` | 质量检查目录 |
| `video-director/references/sources.md` | `3ceea14dc427c1af16bba0384034ab59d9c36c3f` | 上游八个公开仓库与方法来源说明 |
| `METHODOLOGY.md` | `4e09e96ef491d74c180dab548bbcb964f9ee86f5` | 上游方法说明 |
| `README.zh-CN.md` | `6b6e42b44bdbe34196a4dad283bfdd45fe128605` | 上游中文项目说明 |
| `LICENSE` | `2c258d88ca8cf1ec34ac66c79af3b40963463f6f` | MIT 许可 |

运行依赖：Python、ffmpeg/ffprobe、NumPy、Pillow；HTML/Canvas 逐帧渲染还需要目标工程自己的浏览器自动化/渲染依赖。上游 Skill 主要面向 Claude Opus 5.5 / Claude Code；其他编码 Agent 可以参考其流程，但不能据此宣称跨模型等效验证。

本次复制完整 Skill、五份制作/来源参考、两个 QA 脚本、中文 README、方法说明和 LICENSE。上游 demo 视频/动图不是运行依赖；上游 evals 保留在原项目，本仓库不把作者评测样本伪装成自己的生产验证。

## 3. 两个关键脚本的职责与限制

### 3.1 `check_timeline.py`

检查 `timeline.json` 中的分辨率、FPS、时长、时钟类型、场景起止、时间空隙、beat、cut、hero、silence、旁白/字幕节奏、Hook/CTA、术语和文字可读时间等结构约束。

它是编码前的静态合同检查器，不理解剧情、不检查人物动作物理真实性，也不证明渲染结果正确。

### 3.2 `qa_video.py`

对最终 MP4 使用 ffmpeg/ffprobe 和 Python 图像分析，生成 JSON/Markdown 报告及 beat/phone/hook 联系表。覆盖首帧、闪帧、画面突变、冻结/平帧、切点、循环接缝、文字尺寸/对比度、响度、true peak 和静音等客观指标。

无音轨时音频检查不适用；联系表和数值报告也不能替代剧情忠实度、审美、真人表演或独立审片。

## 4. 与 AIGC 现有分镜体系的集成决定

AIGC 已有正式分镜导演、SCG、事件时间契约、人物站位、场景真实性、摄影机运镜和导演共享事实交接。不能再引入第二份世界状态账本。

因此采用单向适配：

`原剧本/批准分镜 → SCG + 事件时间账本 → compile_aigc_timeline.py → video-director timeline.json → 代码动画 → MP4 → QA`

- SCG 继续是每镜 entities / relations / events 的唯一世界状态事实源。
- 事件时间账本继续是镜头/事件时间与可见事件的唯一时序事实源。
- 新增 `compile_aigc_timeline.py` 只将毫秒转换为秒，保留原始 shot_id/event_id，不复制角色状态、道具关系和场景几何。
- 跨镜持续事件如果在下一镜继续可见，渲染 beat 锚定到该镜头起点，同时保留原始事件开始毫秒和 anchor policy。
- FPS、分辨率和 clock 必须来自项目批准规格，不擅自固定为 24/30/60 FPS。
- `timeline.json` 只管理渲染层 cue、文字、字幕、音乐、SFX、切点和 QA 采样点。

## 5. 本仓库新增内容

- `docs/代码动画与程序化视频制作规范-V1.md`：新能力的权威指令源。
- `skills/video-director-cn/SKILL.md`：中文触发入口与执行工作流。
- `skills/video-director-cn/references/`：上游原文与中文速查。
- `skills/video-director-cn/scripts/compile_aigc_timeline.py`：AIGC 事件时间账本单向适配器。
- 上游原始 `check_timeline.py` 和 `qa_video.py`。
- 适配器单元测试、有效样例、包清单 SHA-256 校验和 GitHub Actions MP4 smoke test。
- 根 AGENTS、README、Skill 目录、知识总图和剧本调用清单的路由更新。

CI 工作流引导文件已通过 PR #28 合并到 main；本分支的下一次同步将触发该工作流。当前尚未取得本技能包的 CI 结果，不能标记回归通过。

## 6. 测试与证据状态

本报告初次创建时，仓库回归处于待运行状态。完成 GitHub Actions 后必须把实际 run ID、commit、通过数和失败数回填到本节。

计划验证：

1. Python 语法编译；
2. AIGC 事件时间适配器正向/负向测试；
3. 上游 `check_timeline.py` 对编译结果的通过与 gap 负向拒绝；
4. 技能包文件集合、文件大小和 SHA-256 完整性；
5. ffmpeg 生成的 4 秒合成测试 MP4 通过 `qa_video.py` smoke test。

尚未验证：真实 HTML/Canvas/Three.js/Remotion 工程的浏览器逐帧渲染、用户正式剧集的完整时间轴编译、真实音轨、真人演员表演、目标视频模型服从率、最终生产成片独立审片。

## 7. 采纳等级

建议登记为**中等级 / E3（以回归结果为准）**：上游源码、许可证和脚本可审查；本仓库新增适配器可通过可复现的静态回归。不得升级为 E4，除非在用户真实制作流程中完成受控案例、实际 MP4 渲染和独立审片。

状态：`CODE_REVIEWED_STATIC_REGRESSION_PENDING_TARGET_PRODUCTION_NOT_RUN`。
