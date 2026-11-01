# 导演统筹与场面预演 Skill V1.4.0

本技能是导演层的任务统筹入口，不重复开发已有专业规则。

## 当前权威专业技能版本
- scene-realism-director-cn V1.4.0（conditional）：场景真实性、建筑拓扑、空间功能、透视尺度、物理接触、光照材质、参考图保真、俯视/全景。
- storyboard-director-cn V1.3.4 / source V2.10.5：正式分镜、人物站位/朝向/视线、根节点走位、路径时间、事件时长和连续性。
- 人物站位与场景调度规则 V1.9.0：静态世界/动态人物/摄影机分轨、稳定ID、人工锁定、路径与时间、支撑接触、多人避障、多视角身份锚点。
- camera-motion-director-cn Skill frontmatter 1.0.0 / SOURCE_LOCK 1.1.1：摄影机运动、位置/视线轨迹、模型适配和运镜审片；版本标识未统一，使用时以实际读取的规则为准。
- fight-impact-vfx-cn V1.0.0：打斗动作因果、接触/受击、打击节奏、命中特效、环境反馈和声画同步（当前自身 SOURCE_LOCK 标记 authored_pending_review）。

## 本 Skill 的独有职责
导演意图简报、跨领域任务拆分、专业技能调用顺序、共享事实底稿、跨镜世界状态交接、跨技能冲突消解和整体验收。

单一专业任务直接调用对应技能；跨两个以上领域或明确要求导演整体统筹时，才调用本技能。

## 核心数据边界
- references/导演世界状态交接数据契约-V1.md：导演层场景版本、资产ID、参考图职责、锁定事实和镜头链交接。
- storyboard-director-cn/references/分镜SCG数据契约-V1.md：每镜完整实体、关系、事件和世界状态快照的唯一事实源；不在导演交接包重复维护。
- storyboard-director-cn/references/分镜事件时间数据契约-V1.md：镜头/事件时间、依赖和互斥关系。
- 人物站位规则：角色世界位置、身体/头部/视线、路径、支撑与跨镜状态。
- 运镜技能：摄影机位置、朝向、注视点、焦距和轨迹。

## 文件
- SKILL.md：触发条件、路由、导演意图、共享事实和冲突处理。
- SOURCE_LOCK.json：外部来源许可证、Commit、文件 Blob SHA，以及最新 main 专业依赖版本和哈希。
- references/导演意图与技能交接协议.md：共享事实、动态走位通道、交接顺序和冲突优先级。
- references/导演世界状态交接数据契约-V1.md：跨镜头场景身份、资产/参考图映射、锁定事实和镜头链数据合同。
- tests/fixtures/：十一项路由用例、十一项工作流 A/B 实验数据、高中教室集成基准和世界状态交接正负向基准。
- tests/导演统筹工作流A-B实验协议-V1.md：导演工作流对照；明确与场景提示策略 A/B 隔离。
- tests/导演统筹视觉评分量表-V1.json：沿用场景真实性 P0-P3 和十维 1—5 分，补充动态走位视频检查项。
- tests/templates/导演统筹实验结果模板-V1.json：真实实验结果记录模板，当前保持 NOT_RUN。
- scripts/validate_director_eval.js：A/B 数据集、评分量表和实验状态校验。
- scripts/validate_director_previs.js：依赖 SHA、路由和教室夹具静态校验。
- scripts/validate_world_state_handoff.js：世界状态交接合同的正向/负向结构回归。
- .github/workflows/director-previs-regression.yml：PR 自动回归。

## 验证边界
静态校验通过只证明数据合同和引用结构一致，不证明真实白模工具运行、图像/视频生成服从或视觉质量提升。真实生成和人工审片仍须单独记录。
