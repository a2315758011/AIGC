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