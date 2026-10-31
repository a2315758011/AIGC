# 导演统筹与场面预演 Skill V1.1.1

本技能是导演层的任务统筹入口，不重复开发已有专业规则。

## 三项专业技能
- `scene-realism-director-cn`：场景真实性、建筑拓扑、空间功能、透视尺度、物理接触、光照材质、参考图保真、俯视/全景。
- `storyboard-director-cn`：正式逐镜分镜、人物站位/朝向/视线、走位、轴线、连续性和独立质检。
- `camera-motion-director-cn`：推拉摇移、跟拍、环绕、轨迹/速度、图生视频运镜和运动审片。

## 本 Skill 的独有职责
导演意图简报、跨领域任务拆分、专业技能调用顺序、共享事实底稿、跨技能冲突消解和整体验收。

单一专业任务直接调用对应技能；跨两个以上领域或明确要求导演整体统筹时，才调用本技能。

## 文件
- `SKILL.md`：触发条件、路由、导演意图、共享事实和冲突处理。
- `SOURCE_LOCK.json`：外部来源许可证、Commit、文件 Blob SHA，以及当前 main 的专业依赖版本和哈希。
- `references/导演意图与技能交接协议.md`：共享事实、交接顺序和冲突优先级。
- `tests/fixtures/`：八项路由用例和高中教室集成基准。
- `scripts/validate_director_previs.js`：无第三方依赖的静态合同校验器。
- `.github/workflows/director-previs-regression.yml`：PR 自动回归。
