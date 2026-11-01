# 导演统筹与场面预演 Skill V1.4.0

本技能是导演层的任务统筹入口，不重复开发已有专业规则。

## 当前权威专业技能版本
- `scene-realism-director-cn` V1.4.0（conditional）：场景拓扑、功能布局、透视尺度、光照/色彩/曝光、物体级形状纹理、局部编辑物理副作用和参考图保真。
- `storyboard-director-cn` V1.3.2 / source V2.10.5：正式分镜、动作状态预检、人物调度、动态走位、多机位切点和跨镜连续性。
- 人物站位与场景调度规则 V1.7.0：基础姿势/动作轨道预检、顶视地面路径与摄影机XYZ高度分离、一次性LookAt与持续跟随区分、监视器导出、白模/场景/角色素材职责、预演复杂度门槛和变量级失败诊断。
- `camera-motion-director-cn`：摄影机运动、位置/视线轨迹、模型适配和运镜审片。
- `fight-impact-vfx-cn` V1.0.0：打斗动作因果、接触/受击、打击节奏、命中特效、环境反馈和声画同步（当前自身 SOURCE_LOCK 标记 authored_pending_review）。

## 本 Skill 的独有职责
导演意图简报、跨领域任务拆分、专业技能调用顺序、共享事实底稿、动态预演交接、素材职责隔离、跨技能冲突消解和整体验收。

单一专业任务直接调用对应技能；跨两个以上领域或明确要求导演整体统筹时，才调用本技能。简单单人对白/静态特写不强制做白模；路径、多人物相对运动、绕障碍、升降/环绕/跟拍或多机位切换构成叙事主体时优先预演。

## 文件
- `SKILL.md`：触发条件、路由、导演意图、共享事实和冲突处理。
- `SOURCE_LOCK.json`：外部来源许可证、Commit、文件 Blob SHA，以及最新 main 专业依赖版本和哈希。
- `references/导演意图与技能交接协议.md`：共享事实、动态走位/白模素材通道、交接顺序和冲突优先级。
- `tests/fixtures/`：十三项路由用例、十三项工作流 A/B 实验数据和高中教室集成基准。
- `tests/导演统筹工作流A-B实验协议-V1.md`：只比较是否调用导演统筹；与场景提示策略A/B、白模服从性A/B隔离。
- `tests/导演意图服从性白模A-B协议-V1.md`：只比较是否额外输入白模动态参考视频。
- `tests/导演统筹视觉评分量表-V1.json`：沿用场景真实性P0-P3和十维1—5分，增加白模服从性0—4分与V1.7.0预演门禁。
- `tests/templates/导演统筹实验结果模板-V1.json`：导演工作流结果模板，当前保持 NOT_RUN。
- `tests/templates/白模服从性A-B结果模板-V1.json`：白模动态参考实验模板，当前保持 NOT_RUN。
- `scripts/validate_director_eval.js`：A/B数据集、评分量表和实验状态校验。
- `scripts/validate_director_previs.js`：依赖SHA、路由和教室夹具静态校验。
- `.github/workflows/director-previs-regression.yml`：PR自动回归。

静态检查、文字计划和白模预演均不能冒充真实视频生成验收。
