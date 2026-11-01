# 场景真实性导演与独立质检 Skill V1.9.0

本技能处理 AIGC 场景图的空间假感、建筑结构错误、透视比例异常、家具悬浮/穿插、光影不一致、颜色过艳、材质塑料感、物体局部失真和全景不连续。

## 包含内容

- SKILL.md：触发条件、执行顺序、缺陷分级和验收边界。
- references/场景真实性控制规则-V1.md：权威方法规则，覆盖空间拓扑、功能布局、摄影几何、物理接触、光照、颜色、材质和局部编辑副作用。
- references/场景真实性检查表.md：独立逐项质检，包含空间、光色、物体级和局部编辑检查。
- references/可控生成与诊断工具.md：深度估计、控制图、PBR 和色彩管理的适用边界。
- references/场景图真实性质检与回归样例-V1.json：12 个结构化人工回归用例。
- references/场景真实性原创中文配对基准集-V1.json：8 类场景、64 条可判定问题的原创 A/B 基准。
- references/第三方评测器部署门槛-V1.md：SpatialGenEval、Qwen-Image-Bench、Shedding Light、CFM、PICABench 等工具的资源、许可和费用边界。
- tests/场景真实性回归样例.md：基础场景人工回归。
- tests/场景真实性配对盲评记录模板-V1.1.md：配对盲评、十维评分和结论门槛。
- tests/场景真实性A-B测试执行规程-V1.md：固定参数、盲评、缺陷分级、通过门槛和费用门禁。
- tests/光色物理真实性专项回归-V1.md：光照、颜色、物体级形状纹理和物理编辑副作用测试。
- tests/validate-scene-benchmark.cjs：原创中文基准结构校验器。
- docs/Deepresearch/2026-11-01_场景真实性空间智能基准补充研究.md：SpatialGenEval、GenSpace、InSpace 和全景 3D 路线。
- docs/Deepresearch/2026-11-01_场景真实性光照色彩与物理真实性补充研究.md：Shedding Light、CFM、PICABench、ImagenWorld 和物体级真实感研究。
- docs/Deepresearch/2026-11-01_GPT原生生图场景真实性首轮实测.md：GPT 原生生图四类场景的首轮人工检查、缺陷与后续配对实验计划。\n- references/教室空间权威布局基准-3列5排-V1.json：教室固定空间事实、15张桌椅归一化坐标、相机预设、不变量和未知尺寸边界。\n- references/漫剧场景空间数据库_SCHEMA_V1.json：通用场景数据库结构约束。\n- references/漫剧场景空间数据库模板_V1.json：新场景初始化模板。\n- projects/漫剧场景数据库/CLASSROOM-CN-3X5-001/场景空间数据_V1.json：15桌15椅的独立对象实例、配对关系、固定事实、动态状态和相机预设。\n- tests/validate-scene-database.cjs：无第三方依赖的 Node 场景数据库结构校验器（尚未在目标工作站执行）。\n- references/镜头场景状态交接规范_V1.md：逐镜继承人物、道具、门窗和动态状态，防止镜头间瞬移与状态丢失。\n- tests/validate-shot-continuity.cjs：逐镜状态继承自动检查器，附通过/瞬移失败样例。\n- tests/validate-scene-database.cjs：新增物体占地重叠与通道侵入检查；占地尺寸未知时明确警告。\n- SOURCE_LOCK.json：文件级 Git Blob SHA 与验证状态。

## 使用方式

将整个 scene-realism-director-cn 文件夹导入支持本地 Skill 的 AI 客户端。只导入 SKILL.md 不完整；必须同时提供 references、tests 和 SOURCE_LOCK。

## 适用场景

教室、办公室、住宅、医院、商铺、街道、建筑外观、自然环境、正交俯视、轴测、参考图修复、360/720 全景、漫剧背景和影视场景母版。

## 验收边界

当前状态为 conditional：研究、规则和测试定义已建立；GPT 原生生图已完成四类场景单样本冒烟测试，但严格 A/B 配对、双人盲评、同一权威场景数据驱动的跨视角一致性、光色物理专项盲评和 Windows 运行时验收尚未完成。不得把文档检查或论文结果说成用户模型效果提升。

- references/SCG空间运动与道具状态扩展契约-V1.md：沿用分镜 SCG 数据结构，补充角色移动路径和道具持有约束。
- tests/validate-scg-spatial-motion.cjs：检查二维地面路径与已知障碍相交、普通道具多持有人。
- tests/fixtures/SCG空间运动与道具状态回归-V1.json：包含可通行、穿桌路径和道具双持有人三类回归样例。

- references/SCG三维预演与碰撞检查扩展契约-V1.md：定义人物/摄影机三维代理、XYZ 坐标和碰撞验收边界。
- tests/validate-scg-3d-motion.cjs：无第三方依赖的 SCG 三维代理碰撞检查器。
- tests/fixtures/SCG三维碰撞回归-V1.json：人物地面通行、桌子碰撞、越过低障碍、摄影机穿墙四类回归。
- 场景数据库的固定家具/建筑几何与 SCG 的逐镜动态状态分权威管理，避免重复事实源。
