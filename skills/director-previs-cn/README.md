# 导演统筹与场面预演 Skill V1.4.0

本技能是导演层的任务统筹入口，不重复开发已有专业规则。当前主线专业依赖均以 SOURCE_LOCK 的 Git Blob SHA 为准。

## 当前权威专业技能版本
- `scene-realism-director-cn` V1.10.0（conditional）：场景真实性、建筑拓扑、空间功能、透视尺度、物理接触、光照材质、参考图保真、俯视/全景。
- `storyboard-director-cn` V1.3.4 / source V2.10.5：正式分镜、人物站位/朝向/视线、根节点走位、路径时间、事件时长和连续性。
- 人物站位与场景调度规则 V1.9.0：动态路径、foot grounding/foot planting、关键帧速度连续性、群演一致性、相机位置/视线轨迹分离。
- `camera-motion-director-cn` V1.1.1：摄影机运动、位置/视线轨迹、模型适配和运镜审片。
- `fight-impact-vfx-cn` V1.0.0：打斗动作因果、接触/受击、打击节奏、命中特效、环境反馈和声画同步（当前自身 SOURCE_LOCK 标记 authored_pending_review）。

## 本 Skill 的独有职责
导演意图简报、跨领域任务拆分、专业技能调用顺序、共享事实底稿、动态通道分离、跨技能冲突消解和整体验收。

单一专业任务直接调用对应技能；跨两个以上领域或明确要求导演整体统筹时，才调用本技能。

## 文件
- `SKILL.md`：触发条件、路由、导演意图、共享事实和冲突处理。
- `SOURCE_LOCK.json`：外部来源许可证、Commit、文件 Blob SHA，以及最新 main 专业依赖版本和哈希。
- `references/导演意图与技能交接协议.md`：导演意图、专业分工、交接顺序和冲突优先级。
- `references/导演共享事实与SCG交接规范-V1.md`：复用 SCG 与事件时间权威契约，统一剧本、项目资产、场景、人物/道具、镜头状态和摄影机轨迹的交接，不重复造字段。
- `tests/fixtures/`：十一项路由用例、十一项工作流 A/B 实验数据和高中教室集成基准。
- `tests/导演统筹工作流A-B实验协议-V1.md`：导演工作流对照；明确与场景提示策略 A/B 隔离。
- `tests/导演统筹视觉评分量表-V1.json`：沿用场景真实性 P0-P3 和十维 1—5 分，补充动态走位视频检查项。
- `tests/templates/导演统筹实验结果模板-V1.json`：真实实验结果记录模板，当前保持 NOT_RUN。
- `scripts/validate_director_eval.js`：A/B 数据集、评分量表和实验状态校验。
- `scripts/validate_director_previs.js`：依赖 SHA、路由和教室夹具静态校验。
- `.github/workflows/director-previs-regression.yml`：PR 自动回归。


## 版本与预演状态

- 结构化导演台与多视角角色一致性研究已登记为低等级候选；仅有静态源码/论文证据，未在本工作站安装或运行。
- `manju-director-cn` 离线快照已同步至 V2.10.5，但因与本技能默认分镜路由存在职责重叠，不纳入核心自动路由；用户明确需要漫剧资产+分镜完整闭环时可单独调用。
- 本技能静态回归与真实导演工作流/图像/视频 A/B 分开记录；真实 A/B 当前仍为 NOT_RUN。


## 场景真实性 V1.10.0 的三维能力

- 固定建筑/家具几何由场景数据库维护，逐镜动态状态由 SCG 管理。
- 复杂走位可按需运行三维代理碰撞与固定几何合并检查；未知障碍必须阻断放行。
- AABB 是保守代理，不代表真实网格/骨骼物理；归一化坐标不代表米制尺寸。
- DirectorDesk 适配和场景数据库回归已纳入 GitHub Actions；实际 Windows/DirectorDesk 视口和目标视频模型 A/B 仍未运行。
