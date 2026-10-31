# 更新记录

## 1.2.0 — 2026-11-01
- 接入 main 新增的 `fight-impact-vfx-cn`，补齐打斗动作因果、受击反馈、命中特效和声画同步的专业路由。
- 更新 storyboard-director-cn 至 V1.2.1 / V2.10.5、站位规则至 V1.4.0；更新 scene-realism-director-cn 至 V1.2.1。
- 将 `manju-director-cn` 标记为暂不路由：其离线快照仍引用 V2.10.1，落后于 main 的 V2.10.5，待独立刷新后再接入。
- 扩展回归用例至10项，增加打斗单专业路由与打斗跨专业路由。
- 教室集成场景没有打斗动作，明确跳过 fight-impact-vfx，防止无意义调用。
- GitHub Actions run 41220913784：78 PASS / 0 FAIL。

## 1.1.1 — 2026-11-01
- 以 main 最新提交 `b7d8d86db4235a3ea8ab3c68fd22e90b42ee82c6` 为基线，刷新 scene-realism、storyboard 和 camera-motion 依赖版本及 Blob SHA。
- 将三个外部导演来源锁定到实际 Commit，并记录已读取文件与许可证文件 Blob SHA。
- 新增机器可读的八项路由回归夹具和无第三方依赖的 Node 静态校验器。
- 新增 GitHub Actions PR 回归工作流。
- 修正 README/AGENTS 路由入口，避免把旧分支内容覆盖到更新后的 main。
- 真实工作流 A/B 计时和目标模型图像/视频质量 A/B 仍未执行。

## 1.1.0 — 2026-10-31
- 根据最新 main 分支审计，将本技能改为导演统筹与专业技能路由入口。
- 复用 scene-realism-director-cn、storyboard-director-cn、camera-motion-director-cn，不重复建立场景真实性、人物站位或运镜规则。
- 新增导演意图最小合同、跨技能共享事实底稿和冲突消解流程。
- 新增8项导演统筹回归用例及教室跨技能集成测试基准。
- 真实图像/视频 A/B 尚未执行，不宣称视觉质量提升。

## 1.0.0 — 未合并草案
- 曾尝试独立实现导演预演、场景空间与人物调度规则。
- 与仓库现有场景真实性、分镜和运镜技能存在职责重叠；该草案未合并，已改为统筹路由设计。
