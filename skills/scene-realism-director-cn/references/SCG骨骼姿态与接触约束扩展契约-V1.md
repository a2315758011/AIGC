# SCG 骨骼姿态与接触约束扩展契约 V1

## 权威边界
不建立第二套人物状态账本。场景数据库保存固定家具/地面和接触锚点；SCG entities 保存逐镜角色骨骼绑定与姿态；SCG relations 保存支撑/抓握/扶靠关系及 contact_constraint 元数据；SCG events 保存接触建立和释放。Blender / DirectorDesk 执行真实 IK（逆向运动学），本契约校验器只检查结构和输入的误差报告，不运行 IK。

## 1. 人物骨骼绑定
人物 entity.attributes 可声明：
```json
{"skeletal_rig":{"rig_id":"RIG-01","skeleton_profile":"humanoid_biped_v1","effectors":{"left_foot":"foot_ik.L","right_foot":"foot_ik.R","left_hand":"hand_ik.L","right_hand":"hand_ik.R","pelvis":"pelvis_ctrl"}},"skeletal_pose":{"pose_id":"POSE-01","pose_state":"sitting","clip_id":"CLIP-01","root_motion_separate":true}}
```
rig_id/skeleton_profile/pose_id/clip_id 必须稳定非空；effectors 键使用本契约末端类别，值映射真实骨骼/控制器。根节点位移和骨骼动作片段必须分开，不能把静止姿态沿路径平移当作行走。pose_state 只是姿态标签，不代表已解算。不同角色不默认共用骨骼命名。

末端类别：left_foot、right_foot、left_hand、right_hand、pelvis、torso、back、left_knee、right_knee、left_elbow、right_elbow、left_shoulder、right_shoulder。

## 2. 关系级接触约束
接触约束嵌入现有 relation.contact_constraint，不另建 contacts 数组：
```json
{"subject":"CHAR-01","predicate":"sitting_on","object":"CHAIR-01","contact_constraint":{"id":"CONTACT-01","actor_id":"CHAR-01","effector":"pelvis","target_anchor_id":"seat_center","mode":"support","origin":"baseline","start_ms":0,"end_ms":1200,"tolerance_m":0.03,"status":"planned"}}
```
mode/predicate 对应：support=sitting_on/resting_on；grasp=held_by；brace=resting_on/attached_to。held_by 保持既有方向：道具为 subject、持有人为 object，grasp 的 actor_id 必须等于 object；其他模式人物为 subject、目标为 object。目标实体必须在 attributes.contact_anchors[] 声明 target_anchor_id。仅靠近不能判定接触。

## 3. 生命周期
- origin=baseline：仅首镜可用，表示初始接触。
- origin=event：新接触，source_event_id 必须指向本镜 action=contact_begin 且 contact_id 相同的事件。
- origin=inherited：上一镜必须有相同 contact_id。
- 上一镜存在、本镜消失时，本镜必须有 action=contact_end 且 contact_id 相同的事件。
- 换机位、遮挡、出画和剪辑不能隐式结束接触。

## 4. 时间与误差
start_ms/end_ms 使用项目统一毫秒时间轴，end 大于 start；镜头有 time_start_ms/time_end_ms 时接触区间不得越界。tolerance_m 必须为正数。status=planned 表示仅定义约束，输出未求解警告。status=solver_reported 必须提供 solver、solver_version、measured_error_m、evidence_ref；误差超过 tolerance_m 必须失败。solver_reported 只是数据声明，必须另行审查真实执行器输出。

## 5. 实际三维验收
结构通过后仍需检查：站立双脚支撑和不滑动；坐姿臀部/骨盆接触座面、脚底落地、膝盖不穿桌；扶靠手掌/前臂接触且肘肩不反折；抓握手指包围道具且持有人唯一；行走根路径与步态同步、支撑脚锁定；下一镜首帧继承上一镜尾帧骨骼/接触状态。至少检查动作起点、接触建立、维持、释放和结束姿态。

## 6. 边界
本契约不提供人体动力学、肌肉/软组织、精确网格碰撞或自动动作生成。AABB 通过不代表骨骼无自碰撞、手脚无滑动或抓握成功。缺少 rig、锚点、单位、求解报告或真实视口证据时，不得报告骨骼接触实测通过。
