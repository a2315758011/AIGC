# 多宫格视觉分镜联系表工具

确定性图像排版器。输入由现有分镜导演批准的 JSON 镜头清单和独立画格文件，输出 2×2、3×3、3×4、4×3、5×5 PNG 联系表。

## 原则
- 画格图像必须独立生成并独立保存；联系表是派生文件。
- 以 manifest 的 order 为唯一顺序来源，不按文件名字典序排序。
- 画格等比例缩放并留边，不默认裁切，不拉伸。
- 镜号/时间码由程序绘制，避免模型生成错误文字。
- 缺图、重复镜号、重复顺序、重复源图、越界路径和数量不匹配必须阻断。
- 不修改原图；不生成剧情、人物或场景事实。
- 正式漫画页面仍由 comic-production-director-cn 负责。

## 运行
需要 Python 3.11+ 与 Pillow。

```powershell
python -m pip install -r requirements.txt
python contact_sheet.py --manifest manifest.json --output contact-sheet.png
python contact_sheet.py --manifest manifest.json --validate-only
```

## 清单格式

参考 [manifest.example.json](./manifest.example.json)，并按项目修改：
- `layout`：只能是 `2x2`、`3x3`、`3x4`、`4x3`、`5x5`。
- `panels`：数量必须与布局容量完全一致。
- `order`：从 1 连续编号到格数；这是唯一排版顺序来源。
- `shot_id`：必须唯一。
- `image`：相对于 manifest 的图片路径；禁止绝对路径和越界路径。
- `timecode`：可选；只作为程序标注，不写入原画格。
- `panel_size`、`gutter`、`margin`、`label_height` 和颜色均可配置。

JSON Schema： [manifest.schema.json](./manifest.schema.json)。脚本还会额外检查实际文件存在、图像可解码、源图不重复、标签不溢出和输出不覆盖源文件。

## 布局尺寸

若每格尺寸为 640×360、标签栏 42px、间距 20px、外边距 28px：
- 2×2：1356×880
- 3×3：2016×1302
- 3×4：2676×1302
- 4×3：2016×1724
- 5×5：3336×2146

这些是联系表画布尺寸，不包含独立画格原图。25 格联系表只用于总览，逐格审片必须打开独立画格。

当前工具只负责排版和文件级检查，不判断图像中的角色身份、场景拓扑或镜头连续性；这些仍由 AIGC 现有专业 Skill 独立验收。


## 回归状态（2026-11-02）

- 隔离运行：11/11 单元回归通过，覆盖 2×2、5×5、3×4、4×3、缺图、路径越界、重复顺序/源图、数量不匹配、标签溢出及源图不变性。
- 命令行生成与 `--validate-only`：临时 2×2 样例均通过；校验模式可不提供输出路径，且不会创建输出文件。
- GitHub Actions：工作流文件已提交；本轮连接器未返回对应 push 的运行记录，状态为未验证。
- GPT 原生生图的视觉质量、正式人物/场景连续性、25 格 A/B：尚未执行。

这些测试是文件与排版器回归，不是分镜视觉质量验收。
