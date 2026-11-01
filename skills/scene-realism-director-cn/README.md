# 场景真实性导演与独立质检 Skill V1.14.0

本技能用于控制 AIGC 场景图的建筑拓扑、空间功能、家具布局、透视尺度、物理接触、光照、色彩、材质和跨镜场景连续性。

2026-11-01 基准纠错：当前课堂转校生实测的权威教室布局为用户原图《阳光洒落的整洁教室.png》所示 **4列×6排，共24套桌椅**。此前3列×5排文件只是旧逻辑样例，不得继续作为本用户课堂场景基准。女主具体座位因历史生成式图板冲突暂未锁定。

## 权威数据分工

- 场景数据库：固定建筑、门窗、家具、稳定 ID、坐标单位、占地和碰撞体积。
- 分镜 SCG：逐镜人物/道具/摄影机状态、关系、事件和运动路径。
- GPT 原生生图：负责视觉外观与摄影表现，不作为精确几何建模器。
- DirectorDesk：仅在已授权工具可用时用于白模预演；导入前必须做坐标轴、单位、原点和手性转换，不得直接复制归一化坐标当米制坐标。

## 主要文件

- `SKILL.md`：触发条件、执行顺序、缺陷分级和验收边界。
- `SOURCE_LOCK.json`：文件级 Git Blob SHA、依赖版本和验证状态。
- `references/场景真实性控制规则-V1.md`：空间拓扑、功能布局、摄影几何、物理接触、光材质和局部编辑副作用。
- `references/场景真实性检查表.md`：独立质检清单。
- `references/教室空间权威布局基准-4列6排-V1.json`：依据用户原图建立的24张桌子、24把椅子及建筑锚点的归一化逻辑基准；真实尺寸仍未知。旧3列×5排文件保留为历史通用逻辑样例，不适用于当前课堂实测。
- `references/漫剧场景空间数据库_SCHEMA_V1.json`、`references/漫剧场景空间数据库模板_V1.json`：通用场景数据库结构和空白模板。
- `projects/漫剧场景数据库/CLASSROOM-CN-4X6-001/场景空间数据_V1.json`：当前用户课堂教室实例（24桌/24椅）。家具 footprint 当前为 null，真实尺寸和通道净宽仍未知。
- `references/SCG三维预演与碰撞检查扩展契约-V1.md`：XYZ 坐标、人物/摄影机代理和 AABB 碰撞边界。
- `references/SCG骨骼姿态与接触约束扩展契约-V1.md`：骨骼绑定、接触锚点、跨镜接触生命周期。
- `tests/validate-scg-skeletal-contact.cjs` 与对应 11 组回归：结构/时序校验，不替代真实 IK。
- `tests/evidence/SCG骨骼接触Blender运行验收-20261101.json`：Blender 5.2.1 合成骨架运行烟测 3/3 PASS；生产角色与 DirectorDesk 仍未验收。
- `references/DirectorDesk三维白模预演适配规范-V1.md`：场景数据库/SCG 到 DirectorDesk 的坐标映射与预演流程。
- `scripts/export-directordesk-neutral.cjs`、`tests/test-directordesk-neutral.cjs`：中立预演包导出和坐标转换门禁。
- `tests/validate-scene-database.cjs`：场景数据库结构、对象配对、占地重叠和通道侵入检查。
- `tests/validate-classroom-layout.cjs`：当前用户教室专用4列×6排网格、24桌椅配对和中央通道逻辑检查。
- `tests/validate-shot-continuity.cjs`：逐镜状态继承和瞬移检查。
- `tests/validate-scg-spatial-motion.cjs`：二维地面路径/障碍和道具持有人检查。
- `tests/validate-scg-3d-motion.cjs`：三维代理路径、固定几何合并和未知障碍闭锁。
- `references/SCG骨骼姿态与接触约束扩展契约-V1.md`、`tests/validate-scg-skeletal-contact.cjs`：骨骼绑定、末端映射、支撑/抓握/扶靠、时间冲突和跨镜接触生命周期。
- `tests/validate-scene-benchmark.cjs`：原创中文配对基准结构检查。
- `tests/场景真实性配对盲评记录模板-V1.1.md`、`tests/场景真实性A-B测试执行规程-V1.md`：真实生成对照和独立评审规程。

## 常用回归命令

在仓库根目录执行：

```bash
node skills/scene-realism-director-cn/tests/validate-scene-database.cjs projects/漫剧场景数据库/CLASSROOM-CN-4X6-001/场景空间数据_V1.json
node skills/scene-realism-director-cn/tests/validate-classroom-layout.cjs projects/漫剧场景数据库/CLASSROOM-CN-4X6-001/场景空间数据_V1.json
node skills/scene-realism-director-cn/tests/validate-scene-benchmark.cjs
node skills/scene-realism-director-cn/tests/validate-shot-continuity.cjs skills/scene-realism-director-cn/tests/fixtures/镜头连续性_通过样例.json
node skills/scene-realism-director-cn/tests/validate-scg-spatial-motion.cjs skills/scene-realism-director-cn/tests/fixtures/SCG空间运动与道具状态回归-V1.json
node skills/scene-realism-director-cn/tests/validate-scg-skeletal-contact.cjs skills/scene-realism-director-cn/tests/fixtures/SCG骨骼姿态与接触约束回归-V1.json
node skills/scene-realism-director-cn/tests/validate-scg-3d-motion.cjs skills/scene-realism-director-cn/tests/fixtures/SCG三维碰撞回归-V1.json
```

## 人物骨骼与接触约束

- 接触约束作为 SCG relation.contact_constraint，引用人物 skeletal_rig / skeletal_pose 与目标实体 contact_anchors。
- 结构回归覆盖 11 个正向/负向案例；planned 仅表示约束已定义，不代表 IK 或骨骼接触通过。
- Blender 5.2.1 已完成隔离合成骨架烟测：右手抓握、左脚地面接触、骨盆椅面支撑 3/3 PASS；生产角色导入、DirectorDesk 原生工程、动画脚底锁定、网格碰撞与跨镜连续性仍需独立验收。

## 验收边界

- 当前三维代理碰撞与场景数据库几何合并共 6/6 个回归样例在 Node.js v22.16.0 隔离环境符合预期；DirectorDesk 中立坐标适配自动回归 7/7 通过 GitHub Actions。
- AABB 是保守代理，不是精确网格/骨骼物理；未知几何必须输出 UNRESOLVED，不能当作无碰撞。
- 教室使用 normalized_0_to_1 归一化坐标，不代表真实米制尺寸。家具 footprint 为 null 时，碰撞和净空仍未验证。
- GPT 原生生图四类场景首轮为探索性单样本冒烟测试；严格 A/B、双人盲评、同一三维场景跨视角渲染和目标视频模型服从性尚未完成。
- Windows 工作站隔离临时目录已执行9组Node回归，9/9符合预期；证据见 `tests/evidence/AIGC-Windows-Node-Regression-20261101.json`。这不代表完整本地Git工作树构建。
- DirectorDesk实际白模视口、生产角色骨骼/网格碰撞、真实图像/视频A/B仍需单独验收。不得把结构回归或单张图可见检查说成成片通过。
