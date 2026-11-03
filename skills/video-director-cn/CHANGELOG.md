# 更新记录

## 1.0.0 — 2026-11-03

- 首次采纳 win4r/video-director，固定上游提交 `4747e5c153509ef7f8f7fd1a0aad6acfda36280d`。
- 保留上游 SKILL、制作模板、工艺参数、声音设计、QA 参考、时间轴检查器和 MP4 QA 脚本。
- 新增 AIGC 事件时间账本到 video-director 渲染时间表的单向适配器。
- 明确 SCG/事件时间账本仍是唯一事实源；timeline.json 只管理渲染层。
- 新增中文工作流速查、适配器回归、包清单校验和 GitHub Actions smoke test。
- 未宣称目标视频模型、真人表演或真实生产成片已验证。
