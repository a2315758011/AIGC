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
python -m pip install Pillow
python contact_sheet.py --manifest manifest.json --output contact-sheet.png
python contact_sheet.py --manifest manifest.json --output contact-sheet.png --validate-only
```

完整字段、限制和测试以同目录脚本及 tests 为准。当前工具只负责排版和文件级检查，不判断图像中的角色身份、场景拓扑或镜头连续性；这些仍由 AIGC 现有专业 Skill 独立验收。
