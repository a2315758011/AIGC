# SCG 空间运动与道具状态扩展契约 V1

## 定位

本扩展直接使用 `skills/storyboard-director-cn/references/分镜SCG数据契约-V1.md` 的 scene/shots/entities/relations/events，不创建第二套镜头状态数据库。SCG 是实体、关系和事件的权威来源；本文件只定义可选的空间运动字段和额外检查。

## 一、实体空间属性

对具有地面位置的实体，在 entity.attributes 中可选增加：

```json
{
  "world_position": {"x": 0.25, "y": 0.60},
  "footprint": {"width": 0.08, "depth": 0.06},
  "mobility": "fixed",
  "collision_role": "obstacle"
}
```

- world_position 使用场景自身坐标系；单位必须与场景坐标系统一。
- footprint 是地面投影宽度/深度；必须与 world_position 使用同一单位。
- 尺寸未知时省略 footprint 或显式 null，校验结果为 UNRESOLVED/WARN，不得推断真实尺寸。
- collision_role 可为 obstacle、actor、prop、non_collidable；缺省不参与路径碰撞检测。
- 不可把画面坐标、归一化图像坐标与世界坐标混用。

## 二、移动事件

移动事件仍是 SCG 的 event，在原有 source_id、actor、action、preconditions、effects 字段之外，可选增加 motion：

```json
{
  "id": "EV-MOVE-01",
  "source_id": "SCRIPT-LINE-12",
  "actor": "CHAR-A",
  "action": "move",
  "motion": {
    "entity_id": "CHAR-A",
    "from": {"x": 0.10, "y": 0.20},
    "waypoints": [{"x": 0.25, "y": 0.20}],
    "to": {"x": 0.40, "y": 0.50},
    "start_ms": 1000,
    "end_ms": 2600,
    "path_status": "planned"
  },
  "preconditions": [],
  "effects": [
    {"kind": "set_position", "entity": "CHAR-A", "to": {"x": 0.40, "y": 0.50}}
  ]
}
```

- motion.entity_id 必须存在于当前或前一镜 SCG 实体中。
- from 必须与上一镜该实体 world_position 一致；首镜没有上一镜时，必须由已批准场景基线提供。
- to 必须与本镜实体 world_position 一致，且有 set_position effect。
- start_ms/end_ms 使用项目事件时间轴毫秒基准，end_ms 必须大于 start_ms。
- waypoints 按实际行走顺序排列；不可用摄影机运动代替人物路径。
- 校验器仅检查二维地面路径和已知矩形障碍；楼梯、斜坡、动态障碍、身体姿态包围盒和复杂物理仍需 3D 预演。

## 三、道具持有与生命周期

道具使用稳定 entity.id。持有关系沿用 SCG 硬关系 `held_by`，不得另造 holder 字段作为第二事实源。

- 拾取：事件前置条件确认道具当前可达/所在位置；effects 移除旧支撑/容器关系并添加 held_by。
- 放下：effects 移除 held_by 并添加 resting_on/inside 等新关系。
- 交接：同一事件明确旧持有人与新持有人；事件效果应先移除旧 held_by，再添加新 held_by。
- 普通单人持有道具同一时刻只能有一个 held_by 关系；双手共同持有/多人搬运必须在 entity.attributes 明确声明允许多持有者。
- 画面外、遮挡、暂时不可读不等于道具不存在；存在状态继续按 SCG 的 exists/visible/occluded 分离管理。
- 道具销毁、遗失、消耗必须有来源事件和明确 effects，不得因下一镜未画出就直接删除实体。

## 四、额外错误与状态

- MOTION-01：移动起点与上一镜世界位置不一致。
- MOTION-02：移动终点与本镜世界位置不一致。
- MOTION-03：移动事件缺少时间或时间区间无效。
- MOTION-04：路径线段与已知固定矩形障碍相交。
- MOTION-05：路径终点落在已知障碍内部。
- PROP-01：普通道具同一镜头有多个持有人。
- PROP-02：持有人关系发生变化但缺少对应 SCG event effect。
- UNRESOLVED：障碍/人物占地未知、缺少世界坐标、垂直/动态碰撞条件不足。

## 五、放行边界

该扩展是 SCG 的可选字段约定，不改变原 SCG 核心字段。扩展校验通过只表示“输入数据中可检查的二维路径/持有关系未发现已覆盖错误”；不代表动作在真实三维空间必然可执行，也不代表视频模型会照做。正式放行仍需 3D 白模/真实视频证据。
