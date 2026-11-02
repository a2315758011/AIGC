# 可控表面光效合成工具

本工具将红色能量光纹和金属反光作为独立图层合成到真人底图，不重绘皮肤，不修改原始图像。

## 输入
- 真人底图：PNG/JPEG。
- 蒙版：与底图同尺寸的灰度 PNG；白色为允许叠加特效的皮肤区域，黑色为禁止区域。
- 配置：参考 `effect.example.json`，路径使用 0..1 归一化坐标。
- 可选输出：透明 RGBA 特效图层，便于后续在 Blender/After Effects 中继续调整。

## 运行

```bash
python overlay.py --source plate.png --mask forearm-mask.png --config effect.json --output shot.png --overlay vfx-layer.png
python -m unittest discover -s tests -v
```

## 约束
- 必须提供手工审核过的皮肤区域蒙版；工具不自动猜测手臂位置。
- 光效坐标由镜头设计人员指定；不推断纹身/符号形状。
- 特效只改变像素颜色，不改变人体几何或生成伤口。
- 输出不得覆盖源图；原图保持不变。
- 蒙版外透明度必须为零。
- 当前版本只提供确定性 2D 图层合成，不替代角色/场景一致性审核。

## 当前状态
V1 原型；测试使用合成图像。尚未用批准的人物底图和手臂蒙版完成真实镜头验收。
