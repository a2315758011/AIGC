# AIGC 到 DirectorDesk 的坐标适配与中立预演包 V1

## 为什么不能直接复制 XYZ

SCG 当前只写“X 左右、Y 前后、Z 高度”，没有规定正方向；DirectorDesk 使用 Y 向上、角色前方 +Z。若正方向未声明，即使轴名称相同，也可能产生镜像、人物反向或摄影机反向。

glTF 2.0 规范采用右手坐标系、+Y 向上、+Z 向前，线性单位为米；Blender 的 glTF 导出器会执行 Blender Z-up 到 glTF Y-up 的坐标转换。参考：
- Khronos glTF 2.0 坐标系与单位：https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc
- Blender glTF 导入导出说明：https://github.com/KhronosGroup/glTF-Blender-IO/blob/main/docs/blender_docs/scene_gltf2.rst

这些资料只能说明 glTF/Blender 约定，不能替代对用户安装版 DirectorDesk 原生工程格式的核验。

## 本轮新增交付

- `scripts/export-directordesk-neutral.cjs`：将固定场景数据库和 SCG 转为中立交换 JSON；转换位置、尺寸、路径点，保留稳定 ID。
- `tests/test-directordesk-neutral.cjs`：坐标映射、手性、单位、语义冲突和导出完整性回归。
- `references/DirectorDesk坐标转换清单模板-V1.json`：每个场景必须显式声明源/目标轴正方向、手性、单位、原点偏移和批准依据。

## 强制门禁

1. 每个源轴必须声明正方向语义；不得只写“左右/前后/高度”。
2. 目标轴映射必须是一一对应的轴置换。
3. 源/目标手性必须明确；映射矩阵行列式必须符合手性转换要求。
4. 仅接受米和厘米。归一化坐标/未知单位不得导出米制工程。
5. 轴向、单位、原点或批准依据缺失时立即失败，不生成看似有效的场景。
6. 缺少固定物体三维尺寸或动态实体位置时，导出包标记 unresolved，不得 release_ready。
7. 当前输出是中立交换 JSON，不是原生 .director 文件。必须先核实安装版 DirectorDesk 项目接口，再写原生适配器；不得臆造字段或直接覆盖用户工程。

## 使用方式

```bash
node scripts/export-directordesk-neutral.cjs <场景数据库.json> <SCG.json> <坐标manifest.json> <输出.json>
node tests/test-directordesk-neutral.cjs
```

## 当前限制

- V1 不转换任意欧拉角/四元数朝向，不处理门扇旋转、相机旋转、复杂层级变换；这些应在后续版本明确角度单位和旋转约定后增加。
- 未知对象不会被猜测尺寸。
- 输出不等于 DirectorDesk 视口运行或真实白模验收。


## 坐标约定纠错记录（2026-11-01）

此前示例把目标 +X 写成 right，同时声明 +Y up、+Z forward、右手系；这组语义彼此不相容。glTF 2.0 右手坐标中 +X 指向左侧、-X 指向右侧。已修正测试夹具和模板：源 X right/Y backward/Z up 按左手源处理，目标 X left/Y up/Z forward 按右手目标处理，轴变换行列式为 -1。DirectorDesk 原生目标 X 正方向仍须通过安装版实际项目/视口确认；不能仅因其 +Y up、角色局部 +Z forward 就宣称已确认。


## 摄影机预设导出补充

适配器现已读取场景数据库 `camera_views[]`，将 `camera_position` 与 `look_at` 分别转换为米制目标坐标，保留 view_id、projection 和 one_image_one_camera 输出契约。缺少完整位置或注视点时加入 unresolved 并阻止 release_ready。该实现只覆盖静态预设，不等同于逐镜动态摄影机轨迹、视锥遮挡或原生相机控制已完成。


### 动态摄影机注视点轨道

SCG 摄影机实体的 event.motion 可选携带 `look_at_from`、`look_at_waypoints[]`、`look_at_to`，它们与摄影机光心的 `from/waypoints/to` 是两条独立 XYZ 通道。中立导出器现分别转换为 `look_at_from_m`、`look_at_waypoints_m`、`look_at_to_m`。这只完成数据导出，不代表已生成 DirectorDesk 原生关键帧、平滑插值、视锥遮挡或实际镜头预览；缺少目标点时不得推断摄影机持续跟随。
