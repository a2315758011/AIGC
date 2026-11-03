# 分镜 SCG 数据契约 V1

## 目标
将“剧本事实—场景资产—对象实例—关系—动作—镜头”分离，避免分镜局部描述覆盖上层世界状态。

## 顶层
每个测试用例包含 case_id、expected_ok、expected_errors 与 scene。scene 下面维护完整 shots。

## shot
每个 shot 是该镜头结束时的完整世界状态快照，而不是只写当前画面可见内容。

字段：
- id：镜头稳定 ID。
- time_start_ms / time_end_ms：时间。
- entities：该场景当前仍存在的实体全集；出画/遮挡也不得删除。
- relations：当前有效关系全集。
- events：本镜发生、允许世界状态变化的事件。
- crowd_actions：人物/群体反应事件。

## entity
建议字段：
- id：场景内唯一 ID。
- type：person/object/container/surface/part/body_surface/surface_projection/screen_content/reflection/shadow/surface_mark/post_overlay/hologram。
- source_id：来源于原剧本或已确认资产。
- canonical_asset：权威资产引用。
- parent_id：父对象/容器。
- unique_key：逻辑单实例键；同镜内相同 unique_key 默认不能出现多个。
- allow_multiple：是否允许同 unique_key 多实例。
- exists：是否仍存在于世界中。
- visible：当前是否可见。
- occluded：是否被遮挡。
- attributes：状态属性，如 closed/opaque/readable/floating/role。

关键原则：existence != visibility != in_frame != readability。

## relation
关系形如：{"subject":"phoneA","predicate":"inside","object":"bagA","source_id":"SRC-12"}

硬关系包括：
part_of、inside、attached_to、mounted_on、taped_to、held_by、sitting_on、resting_on、projected_onto、projected_from、displayed_on、reflected_in、reflection_of、casts_shadow_on、shadow_of、lit_by、marked_on。

上述关系跨镜默认保持，除非有 event 明确改变。

## event
事件由 source_id、actor、action、preconditions、effects 构成。事件是唯一允许硬世界状态变化的入口。

## crowd_actions
群体行为必须包含 source_id、trigger_event、actor_ids/scope；剧本未授权时不得创建。partial 不得自动升级为 all。

## 视觉介质约束
- surface_projection 必须 projected_from 投影源 + projected_onto 接收 surface。
- screen_content 必须 displayed_on 屏幕 surface。
- reflection 必须 reflection_of 实体 + reflected_in 反射 surface。
- shadow 必须 shadow_of 实体 + casts_shadow_on 接收 surface + lit_by 光源。
- surface_mark 必须 marked_on/attached_to 某 surface。
- post_overlay 属后期，不进入三维世界关系。
- 只有 hologram 在剧本明确时可 floating=true。

## 错误码
E01 无来源新增实体
E02 实体复制
E03 实体错误消失
E04 身份/权威资产替换
E05 parent 无动作改变
E06 容器/硬关系非法变化
E07 部件/结构关系错误
E08 附着/支撑断裂
E09 表面绑定内容悬浮
E10 投影源/接收面错误
E11 屏幕内容脱屏
E12 反射实体化/缺载体
E13 阴影实体化/缺载体
E14 visibility/existence/readability 混淆
E15 相机改变世界状态
E16 动作前置条件不成立
E17 声明的动作效果未实际成立
E18 持有者/左右手漂移
E19 数量漂移
E20 群体反应无来源
E21 单人/局部行为扩张为群体
E22 已有资产未复用
E23 低层镜头越权重写上层
E24 时间切换错误继承
E25 遮挡后错误重生

## 放行
程序层 PASS 仅代表结构化世界状态没有命中已实现的硬错误，不能替代原剧本忠实度、导演表现、参考资产视觉核验、实际视频生成和成片复核。


## 10. V1.1 面部表演与生成段落连续性扩展

本扩展仍使用现有 SCG `scene.shots` 与 `shot.entities[].attributes`，不建立第二套人物状态账本。它记录模型生成前需要的可见面部表演状态，并引用现有 shot/events；世界时间仍以 shot 的 `time_start_ms/time_end_ms` 与事件时间契约为准。

### 10.1 生成段落分组

仅当任务需要按目标视频模型的片段时长上限拆分生成时，在 `scene` 增加：

```json
{
  "generation_segments": [
    {"id":"GEN-01","shot_ids":["SH-01","SH-02"],"max_duration_ms":10000},
    {"id":"GEN-02","shot_ids":["SH-03"],"max_duration_ms":15000}
  ]
}
```

- `shot_ids` 只引用已有镜头 ID，按场景顺序连续排列；每个镜头恰好属于一个生成段落。
- 每个 shot 增加 `generation_segment_id` 指向所属分组。
- `max_duration_ms` 来自本次实际选定模型/工作流的限制，不在 SCG 中假设所有模型统一为 10 秒或 15 秒。
- 段落时长从首镜 `time_start_ms` 到末镜 `time_end_ms` 推导，不复制另一套时间字段。超过上限必须拆段或重新安排镜头。
- 不使用分段生成时，省略 `generation_segments` 与 `generation_segment_id`。

### 10.2 角色逐镜面部表演状态

在每个需要结构化表演连续性检查的镜头中，将角色面部状态写在该镜头已有 person entity 的 `attributes.facial_performance`：

```json
{
  "face_visibility":"visible",
  "acting_role":"primary",
  "entry_state":{
    "expression_id":"restrained_anger",
    "gaze_target_id":"CHAR-B",
    "brow_state":"furrowed",
    "eye_state":"focused",
    "mouth_state":"lips_pressed",
    "jaw_state":"tense",
    "tension_level":"medium",
    "head_pose":"level",
    "intent":"restrained_anger"
  },
  "beats":[],
  "exit_state":{
    "expression_id":"restrained_anger",
    "gaze_target_id":"CHAR-B",
    "brow_state":"furrowed",
    "eye_state":"focused",
    "mouth_state":"lips_pressed",
    "jaw_state":"tense",
    "tension_level":"medium",
    "head_pose":"level",
    "intent":"restrained_anger"
  },
  "continuity":{
    "mode":"inherit",
    "from_shot_id":"SH-01",
    "segment_boundary":true,
    "reason":"无新的剧情触发，继承上一段尾态"
  }
}
```

字段规则：
- `face_visibility`：`visible` 或 `not_visible`。它描述面部是否可见，不等同于 entity 的世界存在/全身可见状态。
- `acting_role`：`primary`、`reacting`、`speaking`、`background` 或 `none`。仅 primary/reacting/speaking 要求完整表演状态；背景人物不强制逐人设计微表情。
- 当 person entity 在镜头中可见时，必须声明 `facial_performance` 和上述两个分类字段。面部不可见时使用 `not_visible`，不得虚构脸部细节；人物实体出画时仍按 SCG 原规则保留世界状态。
- 当脸部可见且角色承担主要表演、反应或对白任务时，`entry_state` 与 `exit_state` 必须包含示例中的全部规范字段。除 `gaze_target_id` 可为 null 外，其余字段必须为非空字符串；`tension_level` 只能为 low/medium/high。
- `beats` 只记录本镜真实剧情事件触发的表演变化，结构为 `{trigger_event_id,state_after}`；`trigger_event_id` 引用本镜已有 event.id，`state_after` 使用同一完整状态结构。不得复制事件时间字段或重建事件账本。
- `continuity.mode`：首次出现可见表演状态用 `establish`；状态未改变用 `inherit`；剧情触发状态变化用 `change`。
- 有上一可见表演状态时，`from_shot_id` 必须引用最近一次有可见表演状态的 shot。即使角色中间出画或背对镜头，也不能把此前表演状态当作不存在。
- `segment_boundary` 必须与本镜和上一可见表演镜头是否跨 generation segment 一致；跨段时必须明确标记 true。
- `inherit` 的 `entry_state` 必须与上一可见表演镜头的 `exit_state` 完全一致，且本镜不得无触发地改变 exit state。
- `change` 必须提供 `trigger_event_id` 与非空 `reason`；该事件必须存在于上一可见表演镜头之后至当前镜头（含当前镜头）的已有事件中。若表情在本镜内部继续变化，必须用 beats 记录，最后一个 state_after 必须等于 exit_state。
- 有意扑克脸/克制表演是合法状态，例如 expression_id=controlled_neutral、intent=deliberate_restraint；它不因“避免僵尸脸”被强制改成夸张表情。但从上一状态切换到克制中性脸仍须有剧情触发或明确导演事件。
- 自然呼吸、眨眼和不改变表演意图的微小肌肉变化无需逐帧记录；机器校验只验证结构化状态继承，不判断演员表演是否真实自然。

### 10.3 校验边界

新增 `scripts/validate-facial-performance-continuity.cjs`，回归夹具为 `tests/面部表演连续性回归样例-V1.json`。它检查生成段落映射/时长、可见面部状态完整性、跨镜/跨段状态继承、事件触发引用与段内状态推进。负例按预期被识别才算测试通过。

程序不能判断文字表情是否符合剧情、演员是否自然、生成模型是否服从，也不能验证真实视频画面。通过仅表示结构化生成前合同成立；真实 10 秒/15 秒视频仍需目标模型 A/B 与独立审片。
