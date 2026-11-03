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


## 8. V1.1 面部表演与生成段落连续性扩展

本扩展复用现有 `scene.shots[]`、`shot.entities[]`、`shot.events[]`。不得另建与 SCG 并行的人物状态账本或事件账本。它只记录生成前可审计的面部表演状态与生成片段分组；原剧本和 V2.10.6 面部表演规则仍是语义权威。

### 8.1 生成段落分组（按需）

只有任务需要把一个场景拆成多个模型生成片段时，才在 scene 增加：

```json
{
  "generation_segments": [
    {
      "id": "GEN-01",
      "shot_ids": ["SH-01", "SH-02"],
      "model_profile": "provider/model/version",
      "max_duration_ms": 10000,
      "duration_limit_evidence": {
        "status": "verified",
        "source_type": "official_docs",
        "reference": "官方能力说明的可追溯页码/链接/记录编号",
        "verified_at": "2026-11-03"
      }
    }
  ]
}
```

- `shot_ids` 只引用本 scene 已有 shot.id；每个镜头恰好属于一个段落，同一段内必须按 scene.shots 顺序连续。
- 对应 shot 增加 `generation_segment_id`，其值必须与所属段落 id 一致。
- `model_profile` 必须明确到实际供应商、模型和版本；`max_duration_ms` 必须来自当前模型真实上限，不能默认所有模型都支持 10 秒或 15 秒。
- `duration_limit_evidence.status` 必须为 `verified`；`source_type` 为 `official_docs`、`provider_ui` 或 `measured`；`reference` 和 `verified_at` 必填。结构校验只能验证证据记录格式，不能替代人工核实证据真实性。
- 每个 shot 必须有正整数 `time_start_ms` 与 `time_end_ms`；同一段内镜头时间必须按顺序连续、不得重叠或留未建模空档。段落总时长由首镜开始至末镜结束推导，必须不超过 `max_duration_ms`。
- 未使用分段生成时，省略 `generation_segments` 和 `generation_segment_id`，不要求为普通分镜额外填充这些字段。

### 8.2 逐镜面部表演状态

当 person entity 在镜头中可见，且脸部可见并承担主要表演、对白或剧情反应时，在该 entity 的 `attributes.facial_performance` 写入：

```json
{
  "face_visibility": "visible",
  "acting_role": "speaking",
  "entry_state": {
    "expression_id": "restrained_anger",
    "gaze_target_id": "CHAR-B",
    "brow_state": "furrowed",
    "eye_state": "focused",
    "mouth_state": "lips_pressed",
    "jaw_state": "tense",
    "tension_level": "medium",
    "head_pose": "level",
    "intent": "restrained_anger"
  },
  "beats": [],
  "exit_state": {
    "expression_id": "restrained_anger",
    "gaze_target_id": "CHAR-B",
    "brow_state": "furrowed",
    "eye_state": "focused",
    "mouth_state": "lips_pressed",
    "jaw_state": "tense",
    "tension_level": "medium",
    "head_pose": "level",
    "intent": "restrained_anger"
  },
  "continuity": {
    "mode": "inherit",
    "from_shot_id": "SH-01",
    "segment_boundary": true
  }
}
```

规范：
- `face_visibility` 只能是 `visible` / `not_visible`；`acting_role` 只能是 `primary` / `reacting` / `speaking` / `background` / `none`。
- 脸部可见且角色承担 primary/reacting/speaking 时，`entry_state` 和 `exit_state` 必须包含：`expression_id`、`gaze_target_id`、`brow_state`、`eye_state`、`mouth_state`、`jaw_state`、`tension_level`、`head_pose`、`intent`。除 `gaze_target_id` 可为 null 外，其余值必须是非空字符串；`tension_level` 为 low/medium/high。
- `beats` 为数组，每项是 `{ "trigger_event_id": "本镜 shot.events[].id", "state_after": 完整状态 }`。它只引用现有事件，不复制事件时间或建立第二本账。
- 脸部不可见时声明 `face_visibility:"not_visible"` 即可；不要求模型表现不可见的面部细节。角色再次入画时，必须从最近一次脸部可见的有效尾态继续核对。背景人物或不承担剧情反应的角色不强制逐人设计微表情。
- 有意扑克脸、克制、隐忍和不表态均为合法表演；不得为了避免僵尸脸擅自增加夸张表情。

### 8.3 跨镜连续性状态机

`continuity` 的必需字段为 `mode`、`segment_boundary`；有前序可见表演镜头时还必须有 `from_shot_id`。

- `establish`：角色第一次出现可见关键表演状态；不得伪造 `from_shot_id`，`segment_boundary` 必须为 false。若本镜内表情由 entry 变化至 exit，必须用 beats 记录事件及最终状态。
- `inherit`：没有新剧情触发。entry_state 必须与最近一次脸部可见镜头的 exit_state 完全一致；exit_state 也必须保持该状态；不得有 beats。
- `change`：必须提供真实 `trigger_event_id`、非空 `reason` 和 `change_timing`。
  - `change_timing:"before_entry"`：剧情触发发生在上一可见表演镜头之后、当前镜头首态之前（允许触发发生在角色脸部不可见的中间镜头）；当前 entry_state 必须已体现变化。若本镜还继续变化，用 beats 记录，最后一个 state_after 必须等于 exit_state；无 beats 时 entry_state 必须等于 exit_state。
  - `change_timing:"within_shot"`：当前镜头从上一尾态开始，entry_state 必须等于上一 exit_state；beats 必须包含 trigger_event_id，最后一个 state_after 必须等于 exit_state，且 exit_state 必须与 entry_state 不同。
- 有前序可见表演状态时，`from_shot_id` 必须指向最近一次脸部可见且承担表演任务的 shot；角色中间出画或脸部不可见，不会清空此前状态。
- `segment_boundary` 必须准确反映当前镜头与最近一次可见表演镜头是否属于不同 generation segment；未使用 generation_segments 时为 false。
- 无剧情触发的状态归零、无来源变脸、跨段丢失尾态均不允许。若剧情确实改变情绪，必须能追溯到现有 shot.events[] 的事件。

### 8.4 自动预检边界与错误码

配套脚本 `scripts/validate-facial-performance-continuity.cjs` 只在 SCG 启用 `generation_segments` 或 person entity 的 `attributes.facial_performance` 时运行。回归夹具为 `tests/面部表演连续性回归样例-V1.json`。

- F01：段落结构、镜头引用、归属或顺序错误。
- F02：模型上限证据未核实，或段落超过声明上限。
- F03：可见人物缺少 facial_performance。
- F04：关键面部状态字段不完整/非法。
- F05：continuity 声明或来源镜头错误。
- F06：无触发继承不一致/表情无依据归零。
- F07：状态变化没有有效剧情事件或原因。
- F08：beats 不完整或最终状态不一致。
- F09：face_visibility / acting_role 非法。
- F11：生成段落镜头时间缺失、重叠或存在未建模空档。

机器 PASS 仅证明结构化数据符合上述字段与继承合同；它不能判断表演是否符合剧本、演员是否自然、目标模型是否服从，也不能证明实际视频画面通过。实际模型时长能力必须另行核实，真实生成与独立审片分别报告。
